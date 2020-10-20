import { createNodeRedisClient, WrappedNodeRedisClient } from "handy-redis";
import session from "koa-session";

import type { Session } from "../webserver/interfaces";

export interface CacheConfig {
  host: string;
  port?: number;
  namespace?: string;
}

function buildSessionStore(cache: Cache): session.stores {
  return {
    get(key: string, maxAge: number | "session", data: { rolling: boolean }): Promise<unknown> {
      return cache.getSession(key, maxAge != "session" && data.rolling ? maxAge : undefined);
    },

    /**
     * set session object for key, with a maxAge (in ms)
     */
    set(
      key: string,
      sess: Session,
      maxAge: number | "session",
    ): Promise<void> {
      return cache.setSession(key, sess, maxAge == "session" ? undefined : maxAge);
    },

    destroy(key: string): Promise<void> {
      return cache.deleteSession(key);
    },
  };
}

export class Cache {
  public readonly sessionStore: session.stores;

  private constructor(
    private readonly client: WrappedNodeRedisClient,
    private readonly config: CacheConfig,
  ) {
    this.sessionStore = buildSessionStore(this);
  }

  public static async connect(config: CacheConfig): Promise<Cache> {
    let client = createNodeRedisClient({
      host: config.host,
      port: config.port,
    });

    return new Cache(client, config);
  }

  private get prefix(): string {
    if (this.config.namespace) {
      return `pixelbin:${this.config.namespace}:`;
    }

    return "pixelbin:";
  }

  private key(key: string): string {
    return this.prefix + key;
  }

  private async keys(prefix: string = ""): Promise<string[]> {
    let base = this.prefix;
    let keys = await this.client.keys(`${base}${prefix}*`);
    return keys.map((key: string): string => {
      return key.substring(base.length);
    });
  }

  private async get(key: string): Promise<string | null> {
    return this.client.get(this.key(key));
  }

  private async set(key: string, value: string): Promise<void> {
    await this.client.set(this.key(key), value);
  }

  private async expire(key: string, expiry: number): Promise<void> {
    await this.client.pexpire(this.key(key), expiry);
  }

  private async del(keys: string[]): Promise<void> {
    if (keys.length == 0) {
      return;
    }

    await this.client.del(...keys.map((key: string): string => this.key(key)));
  }

  public async getSession(key: string, maxAge?: number): Promise<Session> {
    let session = await this.get(`session:${key}`);

    if (!session) {
      return {};
    }

    if (maxAge) {
      await this.expire(`session:${key}`, maxAge);
    }

    return JSON.parse(session) as unknown as Session;
  }

  public async setSession(key: string, data: Session, maxAge?: number): Promise<void> {
    await this.set(`session:${key}`, JSON.stringify(data));
    if (maxAge) {
      await this.expire(key, maxAge);
    }
  }

  public async deleteSession(key: string): Promise<void> {
    await this.del([`session:${key}`]);
  }

  public async flush(): Promise<void> {
    let keys = await this.keys();
    return this.del(keys);
  }

  public async destroy(): Promise<void> {
    await this.client.quit();
  }
}
