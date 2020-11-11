/* eslint-disable @typescript-eslint/naming-convention */
import type AWS from "aws-sdk";

import type { ObjectModel } from "../model";

type BaseConfig = Pick<
  ObjectModel.Storage,
  "endpoint" | "publicUrl" | "bucket" | "path" | "region"
>;

export function s3Config(storageConfig: BaseConfig): AWS.S3.ClientConfiguration {
  return {
    endpoint: storageConfig.endpoint ?? undefined,
    apiVersion: "2006-03-01",
    s3ForcePathStyle: storageConfig.endpoint ? true : false,
    signatureVersion: "v4",
    region: storageConfig.region,
  };
}

interface S3Params {
  Bucket: string;
  Key: string;
}

function pathAppend(base: string | null, path: string): string {
  if (path.startsWith("/")) {
    path = path.substring(1);
  }

  if (!base) {
    return path;
  }

  if (base.startsWith("/")) {
    base = base.substring(1);
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
