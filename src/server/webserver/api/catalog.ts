import AWS from "aws-sdk";
import fetch from "node-fetch";

import { Api, Create, ObjectModel, Patch, ResponseFor, AWSResult } from "../../../model";
import { isoDateTime, now, s3Config, s3Params, s3PublicUrl } from "../../../utils";
import { UserScopedConnection } from "../../database";
import { ensureAuthenticated, ensureAuthenticatedTransaction } from "../auth";
import { AppContext } from "../context";
import { buildResponseMedia } from "./media";

export const testStorage = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    config: Api.StorageTestRequest,
  ): Promise<Api.StorageTestResult> => {
    let resultCode = AWSResult.UploadFailure;
    let target = "pixelbin-storage-test";
    try {
      let s3 = new AWS.S3({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        ...s3Config(config),
      });

      let content = isoDateTime(now());

      /* eslint-disable @typescript-eslint/naming-convention */
      await s3.upload({
        ...s3Params(config, target),
        Body: content,
        ContentLength: content.length,
      }).promise();
      /* eslint-enable @typescript-eslint/naming-convention */

      resultCode = AWSResult.DownloadFailure;
      let data = await s3.getObject(s3Params(config, target)).promise();

      if (!data.Body) {
        throw new Error("GetObject returned no content.");
      }
      let decoder = new TextDecoder();
      // @ts-ignore: TypeScript sees the Node types here.
      let result = decoder.decode(data.Body);
      if (result != content) {
        throw new Error("GetObject returned incorrect data.");
      }

      resultCode = AWSResult.PreSignedFailure;

      let url = await s3.getSignedUrlPromise("getObject", s3Params(config, target));

      let response = await fetch(url);
      if (response.status != 200) {
        throw new Error(`Pre-signed URL returned a failure status code (${response.statusText}).`);
      }
      let body = await response.text();
      if (body != content) {
        throw new Error("Pre-signed URL returned incorrect data.");
      }

      let publicUrl = s3PublicUrl(config, target);
      if (publicUrl) {
        response = await fetch(publicUrl);
        if (response.status != 200) {
          throw new Error(`Public URL returned a failure status code (${response.statusText}).`);
        }
        body = await response.text();
        if (body != content) {
          throw new Error("Public URL returned incorrect data.");
        }
      }

      await s3.deleteObject(s3Params(config, target)).promise();

      resultCode = AWSResult.DeleteFailure;
    } catch (e) {
      return {
        result: resultCode,
        message: e.message ? e.message : String(e),
      };
    }

    return {
      result: AWSResult.Success,
      message: null,
    };
  },
);

export const createStorage = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.StorageCreateRequest,
  ): Promise<Api.Storage> => {
    let storage = await userDb.createStorage(data);
    let {
      accessKeyId,
      secretAccessKey,
      owner,
      ...rest
    } = storage;
    return rest;
  },
);

export const createCatalog = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<ObjectModel.Catalog>,
  ): Promise<Api.Catalog> => {
    return userDb.createCatalog(data);
  },
);

export const listCatalog = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.CatalogListRequest,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let media = await userDb.listMediaInCatalog(data.id);
    return media.map(buildResponseMedia);
  },
);

export const createAlbum = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Album>,
  ): Promise<Api.Album> => {
    return userDb.createAlbum(data.catalog, data);
  },
);

export const editAlbum = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Patch<Api.Album>,
  ): Promise<Api.Album> => {
    return userDb.editAlbum(data.id, data);
  },
);

export const listAlbum = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.AlbumListRequest,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let media = await userDb.listMediaInAlbum(data.id, data.recursive);
    return media.map(buildResponseMedia);
  },
);

export const createTag = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Tag>,
  ): Promise<Api.Tag> => {
    return userDb.createTag(data.catalog, data);
  },
);

export const editTag = ensureAuthenticated(
  async (ctx: AppContext, userDb: UserScopedConnection, data: Patch<Api.Tag>): Promise<Api.Tag> => {
    return userDb.editTag(data.id, data);
  },
);

export const findTag = ensureAuthenticatedTransaction(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.TagFindRequest,
  ): Promise<Api.Tag[]> => {
    let parent: string | null = null;
    let foundTags: Api.Tag[] = [];

    for (let tag of data.tags) {
      let newTag = await userDb.createTag(data.catalog, {
        parent,
        name: tag,
      });
      foundTags.push(newTag);

      parent = newTag.id;
    }

    return foundTags;
  },
);

export const createPerson = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Person>,
  ): Promise<Api.Person> => {
    return userDb.createPerson(data.catalog, data);
  },
);

export const editPerson = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Patch<Api.Person>,
  ): Promise<Api.Person> => {
    return userDb.editPerson(data.id, data);
  },
);
