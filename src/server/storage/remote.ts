import { Duplex, Readable } from "stream";

import AWS, { Credentials, AWSError } from "aws-sdk";

import { ObjectModel } from "../../model";
import { getLogger, Logger, s3Config, s3Params, s3PublicUrl } from "../../utils";
import { DatabaseConnection } from "../database";

const logger = getLogger("aws");

class DBCredentials extends Credentials {
  public constructor(
    private dbConnection: DatabaseConnection,
    private catalog: string,
    private storage: ObjectModel.Storage,
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
    private storage: ObjectModel.Storage,
  ) {
    super();

    this.logger = logger.child({ catalog });
    this.s3 = new AWS.S3({
      ...s3Config(storage),
      credentials: new DBCredentials(dbConnection, catalog, storage),
      logger: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: (...messages: any[]): void => {
          this.logger.trace(messages.map(String).join(" "));
        },
      },
    });
  }

  public async getUrl(target: string): Promise<string> {
    let publicUrl = s3PublicUrl(this.storage, target);
    if (publicUrl) {
      return publicUrl;
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    return this.s3.getSignedUrlPromise("getObject", {
      ...s3Params(this.storage, target),
      Expires: 60 * 5,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  public async upload(target: string, stream: NodeJS.ReadableStream, size?: number): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.upload({
      ...s3Params(this.storage, target),
      Body: stream,
      ContentLength: size,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    await request.promise();
  }

  public async stream(target: string): Promise<NodeJS.ReadableStream> {
    let request = this.s3.getObject(s3Params(this.storage, target));

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
    await this.s3.deleteObject(s3Params(this.storage, target)).promise();
  }
}
