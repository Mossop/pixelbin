/* eslint-disable @typescript-eslint/naming-convention */
import type AWS from "aws-sdk";

import { ObjectModel } from "../model";

type BaseConfig = Pick<
  ObjectModel.Storage,
  "endpoint" | "publicUrl" | "bucket" | "path"
>;

export function s3Config(storageConfig: BaseConfig): AWS.S3.ClientConfiguration {
  return {
    endpoint: storageConfig.endpoint ?? undefined,
    apiVersion: "2006-03-01",
    s3ForcePathStyle: true,
    signatureVersion: "v4",
  };
}

interface S3Params {
  Bucket: string;
  Key: string;
}

function pathAppend(base: string | null, path: string): string {
  if (!base) {
    return path;
  }

  if (!base.endsWith("/")) {
    return `${base}/${path}`;
  }

  return base + path;
}

export function s3Params(storageConfig: BaseConfig, path: string): S3Params {
  return {
    Bucket: storageConfig.bucket,
    Key: pathAppend(storageConfig.path, path),
  };
}

export function s3PublicUrl(storageConfig: BaseConfig, path: string): string | null {
  if (!storageConfig.publicUrl) {
    return null;
  }

  return pathAppend(storageConfig.publicUrl, path);
}
