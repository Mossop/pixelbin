import { promises as fs } from "fs";

import { Api } from "../../../model";
import { fillMetadata, Relation, UserScopedConnection } from "../../database";
import { ensureAuthenticatedTransaction } from "../auth";
import { AppContext } from "../context";
import { ApiError, ApiErrorCode } from "../error";
import { DeBlobbed } from "./decoders";

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
      await userDb.addMedia(Relation.Album, [createdMedia.id], albums);
    }

    if (tags) {
      await userDb.addMedia(Relation.Tag, [createdMedia.id], tags);
    }

    if (people) {
      await userDb.addMedia(Relation.Person, [createdMedia.id], people);
    }

    let media = await userDb.getMedia(createdMedia.id);
    if (!media) {
      throw new ApiError(ApiErrorCode.UnknownException, {
        message: "Unexpected failure, media does not exist after creation.",
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

    return media;
  },
);
