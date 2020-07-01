import * as Api from "../../../model/api";
import { User } from "../../../model/models";
import * as Db from "../../database";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";
import { DeBlobbed } from "./decoders";

export const createMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    user: User,
    data: DeBlobbed<Api.MediaCreateRequest>,
  ): Promise<Api.Media> => {
    let file = data.file;

    let mediaData: Exclude<DeBlobbed<Api.MediaCreateRequest>, "file" | "catalog"> = {
      ...data,
    };
    delete mediaData.file;
    delete mediaData.catalog;

    let media: Api.Media;
    try {
      media = await Db.createMedia(user.email, data.catalog, Db.fillMetadata(mediaData));
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }

    let storage = await ctx.storage.getStorage(data.catalog);
    await storage.get().copyUploadedFile(media.id, file.path, file.name);
    storage.release();

    return media;
  },
);
