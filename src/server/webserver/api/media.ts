import fss, { promises as fs } from "fs";

import sharp from "sharp";

import {
  AlternateFileType,
  Api,
  ResponseFor,
  ErrorCode,
  RelationType,
} from "../../../model";
import { chooseSize } from "../../../utils";
import { fillMetadata, UserScopedConnection, Media, ProcessedMedia } from "../../database";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import { AppContext } from "../context";
import { ApiError } from "../error";
import { APP_PATHS } from "../paths";
import { DeBlobbed } from "./decoders";

function isProcessedMedia(media: Media): media is ProcessedMedia {
  return "uploaded" in media && !!media.uploaded;
}

export function buildResponseMedia(
  media: Media,
): ResponseFor<Api.Media> {
  if (isProcessedMedia(media)) {
    let {
      original: removedOriginal,
      fileName: removedFileName,
      ...rest
    } = media;
    return {
      ...rest,
      thumbnailUrl: `${APP_PATHS.root}media/thumbnail/${media.id}/${media.original}`,
      originalUrl: `${APP_PATHS.root}media/original/${media.id}/${media.original}`,
      posterUrl: media.mimetype.startsWith("video/")
        ? `${APP_PATHS.root}media/poster/${media.id}/${media.original}`
        : null,
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

export const createMedia = ensureAuthenticated(
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

    let media = await userDb.inTransaction(async (userDb: UserScopedConnection): Promise<Media> => {
      let createdMedia = await userDb.createMedia(catalog, fillMetadata(mediaData));

      if (albums) {
        await userDb.addMediaRelations(RelationType.Album, [createdMedia.id], albums);
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

        await userDb.addMediaRelations(RelationType.Tag, [createdMedia.id], selectedTags);
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
          await userDb.addMediaRelations(RelationType.Person, [createdMedia.id], peopleToAdd);
        }

        if (locations.length) {
          await userDb.setPersonLocations(locations);
        }
      }

      let [media] = await userDb.getMedia([createdMedia.id]);
      if (!media) {
        throw new ApiError(ErrorCode.UnknownException, {
          message: "Creating new media failed for an unknown reason.",
        });
      }

      let storage = await ctx.storage.getStorage(data.catalog);
      try {
        await storage.get().copyUploadedFile(media.id, file.path, file.name);

        try {
          await fs.unlink(file.path);
        } catch (e) {
          ctx.logger.warn(e, "Failed to delete temporary file.");
        }
      } finally {
        storage.release();
      }

      return media;
    });

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

    let media = await userDb.inTransaction(async (userDb: UserScopedConnection): Promise<Media> => {
      let media: Media;
      if (!Object.values(mediaData).every((val: unknown): boolean => val === undefined)) {
        media = await userDb.editMedia(id, mediaData);
      } else {
        let [foundMedia] = await userDb.getMedia([id]);
        if (!foundMedia) {
          throw new ApiError(ErrorCode.NotFound, {
            message: "Media does not exist.",
          });
        }
        media = foundMedia;
      }

      if (albums) {
        await userDb.setMediaRelations(RelationType.Album, [media.id], albums);
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

        await userDb.setMediaRelations(RelationType.Tag, [media.id], selectedTags);
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
          await userDb.setMediaRelations(RelationType.Person, [media.id], []);
          await userDb.setPersonLocations(locations);
          await userDb.addMediaRelations(RelationType.Person, [media.id], peopleToAdd);
        } else {
          await userDb.setMediaRelations(RelationType.Person, [media.id], peopleToAdd);
        }
      }

      if (albums || people || tags) {
        let [foundMedia] = await userDb.getMedia([id]);
        if (!foundMedia) {
          throw new ApiError(ErrorCode.UnknownException);
        }
        media = foundMedia;
      }

      if (file) {
        let storage = await ctx.storage.getStorage(media.catalog);
        try {
          await storage.get().copyUploadedFile(media.id, file.path, file.name);

          try {
            await fs.unlink(file.path);
          } catch (e) {
            ctx.logger.warn(e, "Failed to delete temporary file.");
          }
        } finally {
          storage.release();
        }
      }

      return media;
    });

    if (file) {
      ctx.logger.catch(ctx.taskWorker.handleUploadedFile(media.id));
    }

    return buildResponseMedia(media);
  },
);

export const thumbnail = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    id: string,
    original: string,
    size?: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!isProcessedMedia(media)) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (original != media.original) {
      ctx.status = 301;
      if (size !== undefined) {
        ctx.redirect(`${APP_PATHS.root}media/thumbnail/${id}/${media.original}/${size}`);
      } else {
        ctx.redirect(`${APP_PATHS.root}media/thumbnail/${id}/${media.original}`);
      }
      return;
    }

    let parsedSize = size ? parseInt(size) : 150;

    let source = chooseSize(
      await userDb.listAlternateFiles(media.id, AlternateFileType.Thumbnail),
      parsedSize,
    );

    if (!source) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    let storage = await ctx.storage.getStorage(media.catalog);
    try {
      let path = await storage.get().getLocalFilePath(media.id, source.original, source.fileName);

      if (source.width > source.height && source.width == parsedSize ||
          source.height > source.width && source.height == parsedSize) {
        ctx.set("Content-Type", source.mimetype);
        ctx.body = fss.createReadStream(path);
      } else {
        ctx.set("Content-Type", "image/jpeg");
        ctx.body = await sharp(path).resize(parsedSize, parsedSize, {
          fit: "inside",
        }).jpeg({ quality: 85 }).toBuffer();
      }
    } finally {
      storage.release();
    }
  },
);

export const original = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    id: string,
    original: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!isProcessedMedia(media)) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (original != media.original) {
      ctx.status = 301;
      ctx.redirect(`${APP_PATHS.root}media/original/${id}/${media.original}`);
      return;
    }

    let storage = await ctx.storage.getStorage(media.catalog);
    try {
      let originalUrl = await storage.get().getFileUrl(media.id, media.original, media.fileName);

      ctx.status = 302;
      ctx.redirect(originalUrl);
    } finally {
      storage.release();
    }
  },
);

export const poster = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    id: string,
    original: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!isProcessedMedia(media)) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (original != media.original) {
      ctx.status = 301;
      ctx.redirect(`${APP_PATHS.root}media/poster/${id}/${media.original}`);
      return;
    }

    let posters = await userDb.listAlternateFiles(media.id, AlternateFileType.Poster);
    if (!posters.length) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "No poster image for this media.",
      });
    }

    let storage = await ctx.storage.getStorage(media.catalog);
    try {
      let posterUrl = await storage.get().getFileUrl(media.id, media.original, posters[0].fileName);

      ctx.status = 302;
      ctx.redirect(posterUrl);
    } finally {
      storage.release();
    }
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

export const deleteMedia = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: string[],
  ): Promise<void> => {
    let media = await userDb.getMedia(data);

    for (let item of media) {
      if (!item) {
        return;
      }

      let storage = await ctx.storage.getStorage(item.catalog);
      try {
        if (isProcessedMedia(item)) {
          await storage.get().deleteFile(item.id, item.original, item.fileName);

          let alternates = await userDb.listAlternateFiles(item.id, AlternateFileType.Reencode);
          for (let alternate of alternates) {
            await storage.get().deleteFile(item.id, item.original, alternate.fileName);
          }

          alternates = await userDb.listAlternateFiles(item.id, AlternateFileType.Poster);
          for (let alternate of alternates) {
            await storage.get().deleteFile(item.id, item.original, alternate.fileName);
          }
        }
        await storage.get().deleteLocalFiles(item.id);
        await storage.get().deleteUploadedFile(item.id);
      } finally {
        storage.release();
      }
    }

    await userDb.deleteMedia(data);
  },
);

export const searchMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    search: Api.MediaSearchRequest,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let media = await userDb.searchMedia(search.catalog, search.query);
    return media.map(buildResponseMedia);
  },
);
