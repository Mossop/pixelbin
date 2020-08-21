import fss, { promises as fs } from "fs";

import sharp from "sharp";

import { AlternateFileType, Api } from "../../../model";
import { chooseSize } from "../../../utils";
import { fillMetadata, UserScopedConnection } from "../../database";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import { AppContext } from "../context";
import { ApiError, ApiErrorCode } from "../error";
import { DeBlobbed } from "./decoders";
import { DirectResponse } from "./methods";

export const getMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaGetRequest,
  ): Promise<Api.Media[]> => {
    return userDb.getMedia(data);
  },
);

export const createMedia = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Api.MediaCreateRequest>,
  ): Promise<Api.UnprocessedMedia> => {
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

    return media;
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
      throw new ApiError(ApiErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    let source = chooseSize(
      await userDb.listAlternateFiles(media.id, AlternateFileType.Thumbnail),
      data.size,
    );

    if (!source) {
      throw new ApiError(ApiErrorCode.NotFound, {
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
  ): Promise<Api.Media[]> => {
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

    return userDb.getMedia(Array.from(media.values()));
  },
);
