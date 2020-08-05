import path from "path";
import { Duplex, Readable } from "stream";

import AWS, { Credentials, AWSError } from "aws-sdk";

import { Api } from "../../model";
import { getLogger, Logger } from "../../utils";
import { DatabaseConnection } from "../database";

const logger = getLogger("aws");

class DBCredentials extends Credentials {
  public constructor(
    private dbConnection: DatabaseConnection,
    private catalog: string,
    private storage: Api.Storage,
  ) {
    super(storage.accessKeyId, storage.secretAccessKey);
  }

  private async refreshCredentials(): Promise<void> {
    this.storage = await this.dbConnection.getStorageConfig(this.catalog);
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

export abstract class Remote {
  public abstract upload(
    target: string,
    stream: NodeJS.ReadableStream,
    size?: number,
  ): Promise<void>;
  public abstract getUrl(target: string): Promise<string>;
  public abstract stream(target: string): Promise<NodeJS.ReadableStream>;
  public abstract delete(target: string): Promise<void>;

  public static async getAWSRemote(
    dbConnection: DatabaseConnection,
    catalog: string,
  ): Promise<Remote> {
    let storage = await dbConnection.getStorageConfig(catalog);
    return new AWSRemote(dbConnection, catalog, storage);
  }
}

class AWSRemote extends Remote {
  private s3: AWS.S3;
  private logger: Logger;

  public constructor(
    dbConnection: DatabaseConnection,
    private catalog: string,
    private storage: Api.Storage,
  ) {
    super();

    this.logger = logger.child({ catalog });
    this.logger.trace({
      endpoint: storage.endpoint ?? undefined,
      region: storage.region,
      apiVersion: "2006-03-01",
    }, "Creating S3 service");
    this.s3 = new AWS.S3({
      endpoint: storage.endpoint ?? undefined,
      credentials: new DBCredentials(dbConnection, catalog, storage),
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
    /* eslint-disable @typescript-eslint/naming-convention */
    return this.s3.getSignedUrlPromise("getObject", {
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
      Expires: 60 * 5,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  public async upload(target: string, stream: NodeJS.ReadableStream, size?: number): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.upload({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
      Body: stream,
      ContentLength: size,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    await request.promise();
  }

  public async stream(target: string): Promise<NodeJS.ReadableStream> {
    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.getObject({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

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
    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.deleteObject({
      Bucket: this.storage.bucket,
      Key: this.storage.path ? path.join(this.storage.path, target) : target,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    await request.promise();
  }
}
