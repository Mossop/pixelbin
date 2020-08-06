import { promises as fs } from "fs";

import { Api, ObjectModel } from "../../../model";
import { fillMetadata } from "../../database";
import { ensureAuthenticated } from "../auth";
import { AppContext } from "../context";
import { ApiError, ApiErrorCode } from "../error";
import { DeBlobbed } from "./decoders";

export const createMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    user: ObjectModel.User,
    data: DeBlobbed<Api.MediaCreateRequest>,
  ): Promise<Api.Media> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    let {
      file,
      catalog,
      ...mediaData
    } = data;

    let media: Api.Media;
    try {
      media = await userDb.createMedia(catalog, fillMetadata(mediaData));
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
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
