import fs, { promises as fsp } from "fs";
import path from "path";
import { Duplex, Readable } from "stream";

import AWS, { Credentials, AWSError } from "aws-sdk";

import { Storage } from "../../model/api";
import { getLogger, Logger } from "../../utils";
import { getStorageConfig } from "../database/unsafe";

const logger = getLogger("aws");

class DBCredentials extends Credentials {
  public constructor(private catalog: string, private storage: Storage) {
    super(storage.accessKeyId, storage.secretAccessKey);
  }

  private async refreshCredentials(): Promise<void> {
    this.storage = await getStorageConfig(this.catalog);
    this.accessKeyId = this.storage.accessKeyId;
    this.secretAccessKey = this.storage.secretAccessKey;
  }

  public refresh(callback: (err?: AWSError) => void): void {
    this.refreshCredentials().then((): void => {
      callback();
    }, (error: Error): void => {
      callback(error as AWSError);
    });
  }
}

export class AWSRemote {
  private s3: AWS.S3;
  private logger: Logger;

  private constructor(private catalog: string, private storage: Storage) {
    this.logger = logger.child({ catalog });
    this.logger.trace({
      endpoint: storage.endpoint ?? undefined,
      region: storage.region,
      apiVersion: "2006-03-01",
    }, "Creating S3 service");
    this.s3 = new AWS.S3({
      endpoint: storage.endpoint ?? undefined,
      credentials: new DBCredentials(catalog, storage),
      region: storage.region,
      apiVersion: "2006-03-01",
      s3ForcePathStyle: true,
      signatureVersion: "v4",
      logger: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: (...messages: any[]): void => {
          this.logger.trace(messages.map(String).join(" "));
        },
      },
    });
  }

  public async getUrl(target: string): Promise<string> {
    return this.s3.getSignedUrlPromise("getObject", {
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
      Expires: 60 * 5,
    });
  }

  public async upload(target: string, file: string): Promise<void> {
    let stat = await fsp.stat(file);
    let stream = fs.createReadStream(file);

    let request = this.s3.upload({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
      Body: stream,
      ContentLength: stat.size,
    });

    await request.promise();
  }

  public async stream(target: string): Promise<NodeJS.ReadableStream> {
    let request = this.s3.getObject({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
    });

    let result = await request.promise();
    let body = result.Body;
    if (!body) {
      throw new Error("Unable to retrieve file.");
    }

    if (body instanceof Readable) {
      return body;
    }

    let stream = new Duplex();
    stream.push(body);
    stream.push(null);
    return stream;
  }

  public async delete(target: string): Promise<void> {
    let request = this.s3.deleteObject({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
    });

    await request.promise();
  }

  public static async getRemote(catalog: string): Promise<AWSRemote> {
    let storage = await getStorageConfig(catalog);
    return new AWSRemote(catalog, storage);
  }
}
