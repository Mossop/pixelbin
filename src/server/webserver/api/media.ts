import { createReadStream, promises as fs } from "fs";

import type {
  Api,
  ApiSerialization,
  ObjectModel,
  Requests,
} from "../../../model";
import { ErrorCode, RelationType, emptyMetadata } from "../../../model";
import { isoDateTime } from "../../../utils";
import type { MediaPerson, MediaView, UserScopedConnection } from "../../database";
import { deleteFields } from "../../database/utils";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import type { AppContext } from "../context";
import { ApiError } from "../error";
import { APP_PATHS } from "../paths";
import type { DeBlobbed } from "./decoders";

type DBAlternative = Omit<ObjectModel.AlternateFile, "type"> & {
  fileName: string;
};

export function buildResponseMedia(
  media: MediaView,
): ApiSerialization<Api.Media> {
  if (media.file) {
    let mediaFile = media.file;
    const mapAlternative = (alt: DBAlternative): Api.Alternate => {
      let {
        fileName,
        ...fileInfo
      } = alt;

      return {
        ...fileInfo,
        url: `${APP_PATHS.root}media/${media.id}/${mediaFile.id}/${alt.id}/${alt.fileName}`,
      };
    };

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

        thumbnails: media.file.thumbnails.map(mapAlternative),
        alternatives: media.file.alternatives.map(mapAlternative),

        originalUrl: `${APP_PATHS.root}media/${media.id}/${media.file.id}/${media.file.fileName}`,
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

export const alternate = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    id: string,
    mediaFile: string,
    alternateId: string,
  ): Promise<void> => {
    let [media] = await userDb.getMedia([id]);

    if (!media) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Media does not exist.",
      });
    }

    let alternate = await userDb.getMediaAlternate(id, mediaFile, alternateId);

    if (!alternate) {
      throw new ApiError(ErrorCode.NotFound, {
        message: "Alternate file does not exist.",
      });
    }

    let storage = await ctx.storage.getStorage(media.catalog);
    try {
      if (alternate.local) {
        let filePath = await storage.get().getLocalFilePath(
          id,
          mediaFile,
          alternate.fileName,
        );

        try {
          let stat = await fs.stat(filePath);

          ctx.status = 200;
          ctx.set("Cache-Control", "max-age=1314000,immutable");
          ctx.type = alternate.mimetype;
          ctx.length = stat.size;
          ctx.body = createReadStream(filePath);
        } catch (e) {
          throw new ApiError(ErrorCode.NotFound, {
            message: "Missing local file.",
          });
        }
      } else {
        let fileUrl = await storage.get().getFileUrl(
          id,
          mediaFile,
          alternate.fileName,
          alternate.mimetype,
        );

        ctx.status = 302;
        ctx.set("Cache-Control", "max-age=1314000,immutable");
        ctx.redirect(fileUrl);
      }
    } finally {
      storage.release();
    }
  },
  false,
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
  false,
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
