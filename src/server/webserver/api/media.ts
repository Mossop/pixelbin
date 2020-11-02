import fss, { promises as fs } from "fs";

import sharp from "sharp";

import type {
  Api,
  ApiSerialization,
  Requests,
} from "../../../model";
import {
  AlternateFileType,
  ErrorCode,
  RelationType,
  emptyMetadata,
} from "../../../model";
import { chooseSize, isoDateTime } from "../../../utils";
import type { MediaPerson, MediaView, UserScopedConnection } from "../../database";
import { deleteFields } from "../../database/utils";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import type { AppContext } from "../context";
import { ApiError } from "../error";
import { APP_PATHS } from "../paths";
import type { DeBlobbed } from "./decoders";

export function buildResponseMedia(
  media: MediaView,
): ApiSerialization<Api.Media> {
  if (media.file) {
    return {
      ...media,

      created: isoDateTime(media.created),
      updated: isoDateTime(media.updated),
      taken: media.taken ? isoDateTime(media.taken) : null,

      file: {
        ...deleteFields(media.file, [
          "processVersion",
          "fileName",
        ]),

        thumbnailUrl: `${APP_PATHS.root}media/thumbnail/${media.id}/${media.file.id}`,
        originalUrl: `${APP_PATHS.root}media/original/${media.id}/${media.file.id}`,
        posterUrl: media.file.mimetype.startsWith("video/")
          ? `${APP_PATHS.root}media/poster/${media.id}/${media.file.id}`
          : null,
      },
    };
  }

  return {
    ...media,

    created: isoDateTime(media.created),
    updated: isoDateTime(media.updated),
    taken: media.taken ? isoDateTime(media.taken) : null,

    file: null,
  };
}

function buildMaybeResponseMedia(media: MediaView | null): ApiSerialization<Api.Media> | null {
  if (!media) {
    return null;
  }

  return buildResponseMedia(media);
}

export const getMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Requests.MediaGet,
  ): Promise<(ApiSerialization<Api.Media> | null
  )[]> => {
    let ids = data.id.split(",");
    let media = await userDb.getMedia(ids);
    return media.map(buildMaybeResponseMedia);
  },
);

export const createMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Requests.MediaCreate>,
  ): Promise<ApiSerialization<Api.Media>> => {
    let {
      file,
      catalog,
      albums,
      tags,
      people,
      media: mediaData,
    } = data;

    if (!await ctx.taskWorker.canStartTask()) {
      throw new ApiError(ErrorCode.TemporaryFailure);
    }

    let media = await userDb.inTransaction(
      async function createMedia(userDb: UserScopedConnection): Promise<MediaView> {
        let createdMedia = await userDb.createMedia(catalog, {
          ...emptyMetadata,
          ...mediaData ?? {},
        });

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
          let locations: MediaPerson[] = [];

          for (let person of people) {
            if (typeof person == "string") {
              peopleToAdd.push(person);
            } else if ("person" in person) {
              locations.push({
                media: createdMedia.id,
                person: person.person,
                location: person.location ?? null,
              });
            } else {
              let newPerson = await userDb.createPerson(catalog, {
                name: person.name,
              });
              locations.push({
                media: createdMedia.id,
                person: newPerson.id,
                location: person.location ?? null,
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
        } catch (e) {
          await storage.get().deleteUploadedFile(media.id);
          throw e;
        } finally {
          storage.release();
        }

        return media;
      },
    );

    await ctx.taskWorker.handleUploadedFile(media.id);
    return buildResponseMedia(media);
  },
);

export const updateMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: DeBlobbed<Requests.MediaEdit>,
  ): Promise<ApiSerialization<Api.Media>> => {
    let {
      file,
      id,
      albums,
      tags,
      people,
      media: mediaData,
    } = data;

    if (file && !await ctx.taskWorker.canStartTask()) {
      throw new ApiError(ErrorCode.TemporaryFailure);
    }

    let media = await userDb.inTransaction(
      async function updateMedia(userDb: UserScopedConnection): Promise<MediaView> {
        let media = await userDb.editMedia(id, {
          ...mediaData ?? {},
        });

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
          let locations: MediaPerson[] = [];

          for (let person of people) {
            if (typeof person == "string") {
              peopleToAdd.push(person);
            } else if ("person" in person) {
              locations.push({
                media: media.id,
                person: person.person,
                location: person.location ?? null,
              });
            } else {
              let newPerson = await userDb.createPerson(media.catalog, {
                name: person.name,
              });
              locations.push({
                media: media.id,
                person: newPerson.id,
                location: person.location ?? null,
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
          } catch (e) {
            await storage.get().deleteUploadedFile(media.id);
            throw e;
          } finally {
            storage.release();
          }
        }

        return media;
      },
    );

    if (file) {
      await ctx.taskWorker.handleUploadedFile(media.id);
    }

    return buildResponseMedia(media);
  },
);

export const thumbnail = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    id: string,
    mediaFile: string,
    size?: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!media.file) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (mediaFile != media.file.id) {
      ctx.status = 301;
      if (size !== undefined) {
        ctx.redirect(`${APP_PATHS.root}media/thumbnail/${id}/${media.file.id}/${size}`);
      } else {
        ctx.redirect(`${APP_PATHS.root}media/thumbnail/${id}/${media.file.id}`);
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
      let path = await storage.get().getLocalFilePath(media.id, source.mediaFile, source.fileName);

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

      ctx.set("Cache-Control", "max-age=1314000,immutable");
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
    mediaFile: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!media.file) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (mediaFile != media.file.id) {
      ctx.status = 301;
      ctx.redirect(`${APP_PATHS.root}media/original/${id}/${media.file.id}`);
      return;
    }

    let storage = await ctx.storage.getStorage(media.catalog);
    try {
      let originalUrl = await storage.get().getFileUrl(
        media.id,
        media.file.id,
        media.file.fileName,
        media.file.mimetype,
      );

      ctx.status = 302;
      ctx.set("Cache-Control", "max-age=1314000,immutable");
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
    mediaFile: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    if (!media.file) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media not yet processed.",
      });
    }

    if (mediaFile != media.file.id) {
      ctx.status = 301;
      ctx.redirect(`${APP_PATHS.root}media/poster/${id}/${media.file.id}`);
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
      let posterUrl = await storage.get().getFileUrl(
        media.id,
        media.file.id,
        posters[0].fileName,
        posters[0].mimetype,
      );

      ctx.status = 302;
      ctx.set("Cache-Control", "max-age=1314000,immutable");
      ctx.redirect(posterUrl);
    } finally {
      storage.release();
    }
  },
);

function isMedia(item: MediaView | null): item is MediaView {
  return !!item;
}

export const relations = ensureAuthenticatedTransaction(
  async function setMediaRelations(
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Requests.MediaRelations[],
  ): Promise<ApiSerialization<Api.Media>[]> {
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
    data: Requests.MediaPeople,
  ): Promise<ApiSerialization<Api.Media>[]> => {
    let includedMedia = new Set<string>();
    let changes = new Map<string, MediaPerson>();
    for (let location of data) {
      includedMedia.add(location.media);
      changes.set(`${location.media},${location.person}`, {
        media: location.media,
        person: location.person,
        location: location.location ?? null,
      });
    }

    await userDb.setPersonLocations([...changes.values()]);

    let results = await userDb.getMedia([...includedMedia]);
    return results.filter(isMedia)
      .map(buildResponseMedia);
  },
);

export const deleteMedia = ensureAuthenticated(
  async function deleteMedia(
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: string[],
  ): Promise<void> {
    await userDb.deleteMedia(data);
  },
);
