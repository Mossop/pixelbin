import { JsonDecoder } from "ts.data.json";

import { MappingDecoder } from "../../utils";
import type { DatabaseConnection } from "./connection";
import type { Tables } from "./types";

function optional<A>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<A | null> {
  return MappingDecoder(JsonDecoder.optional(decoder), (result: A | undefined): A | null => {
    return result ?? null;
  }, name);
}

export type SeedCatalog = Omit<Tables.Catalog, "id" | "storage">;

export type SeedStorage = Omit<Tables.Storage, "id" | "owner"> & {
  catalogs?: SeedCatalog[];
};

export type SeedUser = Omit<Tables.User, "created" | "lastLogin" | "verified"> & {
  storage?: SeedStorage[];
};

export interface Seed {
  users?: SeedUser[];
}

const SeedCatalogDecoder = JsonDecoder.object<SeedCatalog>({
  name: JsonDecoder.string,
}, "SeedCatalog");

const SeedStorageDecoder = JsonDecoder.object<SeedStorage>({
  name: JsonDecoder.string,
  accessKeyId: JsonDecoder.string,
  secretAccessKey: JsonDecoder.string,
  bucket: JsonDecoder.string,
  region: JsonDecoder.string,
  path: optional(JsonDecoder.string, "path?"),
  endpoint: optional(JsonDecoder.string, "endpoint?"),
  publicUrl: optional(JsonDecoder.string, "publicUrl?"),
  catalogs: JsonDecoder.optional(JsonDecoder.array(SeedCatalogDecoder, "SeedCatalog[]")),
}, "SeedStorage");

const SeedUserDecoder = JsonDecoder.object<SeedUser>({
  email: JsonDecoder.string,
  fullname: JsonDecoder.string,
  password: JsonDecoder.string,
  storage: JsonDecoder.optional(JsonDecoder.array(SeedStorageDecoder, "SeedStorage[]")),
}, "SeedUser");

export const SeedDecoder = JsonDecoder.object<Seed>({
  users: JsonDecoder.optional(JsonDecoder.array(SeedUserDecoder, "SeedUser[]")),
}, "Seed");

export async function seed(this: DatabaseConnection, seed: Seed): Promise<void> {
  return this.inTransaction("seeding", async (db: DatabaseConnection): Promise<void> => {
    for (let seedUser of seed.users ?? []) {
      let {
        storage,
        ...userData
      } = seedUser;

      let { email: userEmail } = await db.createUser(userData);
      let userDb = db.forUser(userEmail);

      for (let seedStorage of storage ?? []) {
        let {
          catalogs,
          ...storageData
        } = seedStorage;

        let { id: storageId } = await userDb.createStorage(storageData);

        for (let seedCatalog of catalogs ?? []) {
          await userDb.createCatalog(storageId, seedCatalog);
        }
      }
    }
  });
}
