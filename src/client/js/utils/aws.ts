/* eslint-disable @typescript-eslint/naming-convention */
import moment from "moment-timezone";

import { Create, ObjectModel } from "../../../model";
import { fetch } from "../environment";

export enum AWSFailure {
  Upload = "upload",
  Download = "download",
  PreSigned = "presigned",
  Delete = "delete",
  PublicUrl = "public-url",
}

export class AWSError extends Error {
  public readonly failure: AWSFailure;
  public readonly message: string;

  public constructor(failure: AWSFailure, message: string) {
    super(`AWS failure in "${failure}" stage: ${message}`);

    this.failure = failure;
    this.message = message;
  }
}

export async function testStorageConfig(
  config: Create<Omit<ObjectModel.Storage, "owner">>,
): Promise<void> {
  const AWS = await import(/* webpackChunkName: "AWS" */ "aws-sdk");

  let failure = AWSFailure.Upload;
  let target = "pixelbin-storage-test";
  let objectKey = config.path ? `${config.path}/${target}` : target;
  try {
    let s3 = new AWS.S3({
      endpoint: config.endpoint ?? undefined,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      apiVersion: "2006-03-01",
      s3ForcePathStyle: true,
      signatureVersion: "v4",
    });

    let content = moment().utc().toISOString();

    await s3.upload({
      Bucket: config.bucket,
      Key: objectKey,
      Body: content,
      ContentLength: content.length,
    }).promise();

    failure = AWSFailure.Download;
    let data = await s3.getObject({
      Bucket: config.bucket,
      Key: objectKey,
    }).promise();

    if (!data.Body) {
      throw new Error("GetObject returned no content.");
    }
    let decoder = new TextDecoder();
    // @ts-ignore: TypeScript sees the Node types here.
    let result = decoder.decode(data.Body);
    if (result != content) {
      throw new Error("GetObject returned incorrect data.");
    }

    failure = AWSFailure.PreSigned;

    let url = await s3.getSignedUrlPromise("putObject", {
      Bucket: config.bucket,
      Key: objectKey,
    });

    let response = await fetch(url);
    if (response.status != 200) {
      throw new Error(`Pre-signed URL returned a failure status code (${response.statusText}).`);
    }
    let body = await response.text();
    if (body != content) {
      throw new Error("Pre-signed URL returned incorrect data.");
    }

    if (config.publicUrl) {
      let publicUrl = config.publicUrl;
      if (!publicUrl.endsWith("/")) {
        publicUrl += "/";
      }

      publicUrl += objectKey;

      response = await fetch(url);
      if (response.status != 200) {
        throw new Error(`Public URL returned a failure status code (${response.statusText}).`);
      }
      body = await response.text();
      if (body != content) {
        throw new Error("Public URL returned incorrect data.");
      }
    }

    await s3.deleteObject({
      Bucket: config.bucket,
      Key: objectKey,
    }).promise();

    failure = AWSFailure.Delete;
  } catch (e) {
    throw new AWSError(failure, "message" in e ? e.message : String(e));
  }
}
