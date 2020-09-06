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

function buildMaybeResponseMedia(media: Media | null): ResponseFor<Api.Media> | null {
  if (!media) {
    return null;
  }

  return buildResponseMedia(media);
}

export const getMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaGetRequest,
  ): Promise<(ResponseFor<Api.Media> | null)[]> => {
    let ids = data.id.split(",");
    let media = await userDb.getMedia(ids);
    return media.map(buildMaybeResponseMedia);
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
      let selectedTags: string[] = [];

      for (let tag of tags) {
        if (Array.isArray(tag)) {
          if (tag.length) {
            let newTags = await userDb.buildTags(catalog, tag);
            selectedTags.push(newTags[newTags.length - 1].id);
          }
        } else {
          selectedTags.push(tag);
        }
      }

      await userDb.addMediaRelations(Api.RelationType.Tag, [createdMedia.id], selectedTags);
    }

    if (people) {
      let peopleToAdd: string[] = [];
      let locations: Api.MediaPersonLocation[] = [];

      for (let person of people) {
        if (typeof person == "string") {
          peopleToAdd.push(person);
        } else if ("id" in person) {
          locations.push({
            media: createdMedia.id,
            person: person.id,
            location: person.location,
          });
        } else {
          let newPerson = await userDb.createPerson(catalog, {
            name: person.name,
          });
          locations.push({
            media: createdMedia.id,
            person: newPerson.id,
            location: person.location,
          });
        }
      }

      if (peopleToAdd.length) {
        await userDb.addMediaRelations(Api.RelationType.Person, [createdMedia.id], peopleToAdd);
      }

      if (locations.length) {
        await userDb.setPersonLocations(locations);
      }
    }

    let [media] = await userDb.getMedia([createdMedia.id]);
    if (!media) {
      throw new ApiError(Api.ErrorCode.UnknownException, {
        message: "Creating new media failed for an unknown reason.",
      });
    }

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

export const updateMedia = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Api.MediaUpdateRequest>,
  ): Promise<ResponseFor<Api.Media>> => {
    let {
      file,
      id,
      albums,
      tags,
      people,
      ...mediaData
    } = data;

    let media: Media;
    if (!Object.values(mediaData).every((val: unknown): boolean => val === undefined)) {
      media = await userDb.editMedia(id, mediaData);
    } else {
      let [foundMedia] = await userDb.getMedia([id]);
      if (!foundMedia) {
        throw new ApiError(Api.ErrorCode.NotFound, {
          message: "Media does not exist.",
        });
      }
      media = foundMedia;
    }

    if (albums) {
      await userDb.setMediaRelations(Api.RelationType.Album, [media.id], albums);
    }

    if (tags) {
      let selectedTags: string[] = [];

      for (let tag of tags) {
        if (Array.isArray(tag)) {
          if (tag.length) {
            let newTags = await userDb.buildTags(media.catalog, tag);
            selectedTags.push(newTags[newTags.length - 1].id);
          }
        } else {
          selectedTags.push(tag);
        }
      }

      await userDb.setMediaRelations(Api.RelationType.Tag, [media.id], selectedTags);
    }

    if (people) {
      let peopleToAdd: string[] = [];
      let locations: Api.MediaPersonLocation[] = [];

      for (let person of people) {
        if (typeof person == "string") {
          peopleToAdd.push(person);
        } else if ("id" in person) {
          locations.push({
            media: media.id,
            person: person.id,
            location: person.location,
          });
        } else {
          let newPerson = await userDb.createPerson(media.catalog, {
            name: person.name,
          });
          locations.push({
            media: media.id,
            person: newPerson.id,
            location: person.location,
          });
        }
      }

      if (locations.length) {
        await userDb.setMediaRelations(Api.RelationType.Person, [media.id], []);
        await userDb.setPersonLocations(locations);
        await userDb.addMediaRelations(Api.RelationType.Person, [media.id], peopleToAdd);
      } else {
        await userDb.setMediaRelations(Api.RelationType.Person, [media.id], peopleToAdd);
      }
    }

    if (albums || people || tags) {
      let [foundMedia] = await userDb.getMedia([id]);
      if (!foundMedia) {
        throw new ApiError(Api.ErrorCode.UnknownException);
      }
      media = foundMedia;
    }

    if (file) {
      let storage = await ctx.storage.getStorage(media.catalog);
      await storage.get().copyUploadedFile(media.id, file.path, file.name);
      storage.release();

      try {
        await fs.unlink(file.path);
      } catch (e) {
        ctx.logger.warn(e, "Failed to delete temporary file.");
      }

      ctx.logger.catch(ctx.taskWorker.handleUploadedFile(media.id));
    }

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

function isMedia(item: Media | null): item is Media {
  return !!item;
}

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
    return results.filter(isMedia)
      .map(buildResponseMedia);
  },
);

export const setMediaPeople = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.MediaPersonLocation[],
  ): Promise<ResponseFor<Api.Media>[]> => {
    let includedMedia = new Set<string>();
    let changes = new Map<string, Api.MediaPersonLocation>();
    for (let location of data) {
      includedMedia.add(location.media);
      changes.set(`${location.media},${location.person}`, location);
    }

    await userDb.setPersonLocations([...changes.values()]);

    let results = await userDb.getMedia([...includedMedia]);
    return results.filter(isMedia)
      .map(buildResponseMedia);
  },
);
