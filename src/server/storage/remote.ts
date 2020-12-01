import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { Duplex, Readable } from "stream";

import type { AWSError, S3 } from "aws-sdk";
import AWS, { Credentials } from "aws-sdk";
import fetch from "node-fetch";

import type { ObjectModel } from "../../model";
import type { Logger } from "../../utils";
import { getLogger, s3Config, s3Params, s3PublicUrl } from "../../utils";
import type { DatabaseConnection } from "../database";

const logger = getLogger("aws");
const httpAgent = new HttpAgent({
  maxSockets: 25,
  keepAlive: true,
});
const httpsAgent = new HttpsAgent({
  maxSockets: 25,
  keepAlive: true,
});

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
    size: number,
    mimetype: string,
  ): Promise<void>;
  public abstract copy(source: string, target: string): Promise<void>;
  public abstract getUrl(target: string, contentType?: string): Promise<string>;
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

    let agent: HttpsAgent | HttpAgent = httpsAgent;
    if (storage.endpoint?.startsWith("http:")) {
      agent = httpAgent;
    }

    this.logger = logger.withBindings({ catalog });
    this.s3 = new AWS.S3({
      ...s3Config(storage),
      httpOptions: {
        agent,
      },
      credentials: new DBCredentials(dbConnection, catalog, storage),
      logger: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        log: (...messages: any[]): void => {
          this.logger.trace(messages.map(String).join(" "));
        },
      },
    });
  }

  public getFullTarget(target: string): string {
    return `${this.catalog}/${target}`;
  }

  public async getUrl(target: string, contentType?: string): Promise<string> {
    let publicUrl = s3PublicUrl(this.storage, this.getFullTarget(target));
    if (publicUrl) {
      return publicUrl;
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    return this.s3.getSignedUrlPromise("getObject", {
      ...s3Params(this.storage, this.getFullTarget(target)),
      Expires: 60 * 5,
      ResponseCacheControl: "max-age=1314000,immutable",
      ResponseContentType: contentType,
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  public async upload(
    target: string,
    stream: NodeJS.ReadableStream,
    size: number,
    mimetype: string,
  ): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.upload({
      ...s3Params(this.storage, this.getFullTarget(target)),
      Body: stream,
      ContentLength: size,
      CacheControl: "max-age=1314000, immutable",
      ContentType: mimetype,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    try {
      await request.promise();
    } catch (e) {
      throw new Error(`Failed to upload file to '${target}': ${e}`);
    }
  }

  public async copy(source: string, target: string): Promise<void> {
    let copySource = s3Params(this.storage, this.getFullTarget(source));

    /* eslint-disable @typescript-eslint/naming-convention */
    let request = this.s3.copyObject({
      ...s3Params(this.storage, this.getFullTarget(target)),
      CopySource: `/${copySource.Bucket}/${copySource.Key}`,
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    try {
      await request.promise();
    } catch (e) {
      throw new Error(`Failed to copy file from '${source}' to '${target}': ${e}`);
    }
  }

  public async stream(target: string): Promise<NodeJS.ReadableStream> {
    let publicUrl = s3PublicUrl(this.storage, this.getFullTarget(target));
    if (publicUrl) {
      let response = await fetch(publicUrl);
      return response.body;
    }

    let request = this.s3.getObject(s3Params(this.storage, this.getFullTarget(target)));

    let result: S3.GetObjectOutput;
    try {
      result = await request.promise();
    } catch (e) {
      throw new Error(`Failed to retrieve '${target}': ${e}`);
    }

    let body = result.Body;
    if (!body) {
      throw new Error(`Failed to retrieve '${target}'.`);
    }

    let stream = new Duplex();

    if (body instanceof Readable) {
      body.on("error", (error: Error) => {
        stream.destroy(new Error(`Failed to retrieve '${target}': ${error}`));
      });
      return body.pipe(stream);
    }

    stream.push(body);
    stream.push(null);
    return stream;
  }

  public async delete(target: string): Promise<void> {
    try {
      await this.s3.deleteObject(s3Params(this.storage, this.getFullTarget(target))).promise();
    } catch (e) {
      throw new Error(`Failed to delete '${target}': ${e}`);
    }
  }
}
