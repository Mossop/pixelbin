import fss, { promises as fs } from "fs";

import sharp from "sharp";

import { AlternateFileType, Api, ResponseFor } from "../../../model";
import { chooseSize } from "../../../utils";
import { fillMetadata, UserScopedConnection, Media } from "../../database";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import { AppContext } from "../context";
import { ApiError } from "../error";
import { DeBlobbed } from "./decoders";
import { DirectResponse } from "./methods";

function isProcessedMedia(media: Api.Media): media is Api.ProcessedMedia {
  return "uploaded" in media && !!media.uploaded;
}

export function buildResponseMedia(
  media: Media,
): ResponseFor<Api.Media> {
  if (isProcessedMedia(media)) {
    return {
      ...media,
      created: media.created.toISOString(),
      uploaded: media.uploaded.toISOString(),
      taken: media.taken?.toISOString() ?? null,
    };
  } else {
    return {
      ...media,
      created: media.created.toISOString(),
      taken: media.taken?.toISOString() ?? null,
    };
  }
}

export const getMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaGetRequest,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let ids = data.id.split(",");
    let media = await userDb.getMedia(ids);
    return media.map(buildResponseMedia);
  },
);

export const createMedia = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Api.MediaCreateRequest>,
  ): Promise<ResponseFor<Api.UnprocessedMedia>> => {
    let {
      file,
      catalog,
      albums,
      tags,
      people,
      ...mediaData
    } = data;

    let createdMedia = await userDb.createMedia(catalog, fillMetadata(mediaData));

    if (albums) {
      await userDb.addMediaRelations(Api.RelationType.Album, [createdMedia.id], albums);
    }

    if (tags) {
      await userDb.addMediaRelations(Api.RelationType.Tag, [createdMedia.id], tags);
    }

    if (people) {
      await userDb.addMediaRelations(Api.RelationType.Person, [createdMedia.id], people);
    }

    let [media] = await userDb.getMedia([createdMedia.id]);
    let storage = await ctx.storage.getStorage(data.catalog);
    await storage.get().copyUploadedFile(media.id, file.path, file.name);
    storage.release();

    try {
      await fs.unlink(file.path);
    } catch (e) {
      ctx.logger.warn(e, "Failed to delete temporary file.");
    }

    ctx.logger.catch(ctx.taskWorker.handleUploadedFile(media.id));

    return buildResponseMedia(media);
  },
);

export const thumbnail = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaThumbnailRequest,
  ): Promise<DirectResponse> => {
    let [media] = await userDb.getMedia([data.id]);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!media) {
      throw new ApiError(Api.ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    let source = chooseSize(
      await userDb.listAlternateFiles(media.id, AlternateFileType.Thumbnail),
      data.size,
    );

    if (!source) {
      throw new ApiError(Api.ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    let storage = await ctx.storage.getStorage(media.catalog);

    let path = await storage.get().getLocalFilePath(media.id, source.original, source.fileName);

    if (source.width > source.height && source.width == data.size ||
        source.height > source.width && source.height == data.size) {
      return new DirectResponse(source.mimetype, fss.createReadStream(path));
    }

    return new DirectResponse("image/jpeg", await sharp(path).resize(data.size, data.size, {
      fit: "inside",
    }).jpeg({ quality: 85 }).toBuffer());
  },
);

export const relations = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Api.MediaRelationChange[]>,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let media = new Set<string>();

    for (let change of data) {
      change.media.forEach((id: string) => void media.add(id));

      if (change.operation == "add") {
        await userDb.addMediaRelations(change.type, change.media, change.items);
      } else if (change.operation == "delete") {
        await userDb.removeMediaRelations(change.type, change.media, change.items);
      } else if (change.operation == "setMedia") {
        await userDb.setRelationMedia(change.type, change.items, change.media);
      } else {
        await userDb.setMediaRelations(change.type, change.media, change.items);
      }
    }

    let results = await userDb.getMedia(Array.from(media.values()));
    return results.map(buildResponseMedia);
  },
);

export const setMediaPeople = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaPersonLocation[],
  ): Promise<ResponseFor<Api.Media>[]> => {
    return userDb.inTransaction(
      async (userDb: UserScopedConnection): Promise<ResponseFor<Api.Media>[]> => {
        let includedMedia = new Set<string>();
        let changes = new Map<string, Api.MediaPersonLocation>();
        for (let location of data) {
          includedMedia.add(location.media);
          changes.set(`${location.media},${location.person}`, location);
        }

        await userDb.setPersonLocations([...changes.values()]);

        let results = await userDb.getMedia([...includedMedia]);
        return results.map(buildResponseMedia);
      },
    );
  },
);
