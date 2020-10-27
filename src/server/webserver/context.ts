import type { Context } from "koa";
import type session from "koa-session";

import type { DatabaseConnection, UserScopedConnection } from "../database";
import type { StorageService } from "../storage";
import type { RemoteInterface } from "../worker";
import type { AuthContext } from "./auth";
import authContext from "./auth";
import type { Session, TaskWorkerInterface } from "./interfaces";
import type { LoggingContext } from "./logging";
import loggingContext from "./logging";
import Services from "./services";

export type DescriptorsFor<C> = {
  [K in keyof C]: TypedPropertyDescriptor<C[K]>;
};

export type ServicesContext = AuthContext & LoggingContext & {
  readonly storage: StorageService;
  readonly taskWorker: RemoteInterface<TaskWorkerInterface>;
  readonly dbConnection: DatabaseConnection;
  readonly userDb: UserScopedConnection | null;
};
export type AppContext = Omit<Context, "session"> & ServicesContext & {
  readonly session: (Session & session.Session) | null;
};

export async function buildContext(): Promise<DescriptorsFor<ServicesContext>> {
  let storage = await Services.storage;
  let parent = await Services.parent;
  let dbConnection = await Services.database;

  return {
    ...loggingContext(),
    ...authContext(),

    userDb: {
      get(this: AppContext): UserScopedConnection | null {
        if (this.user) {
          return this.dbConnection.forUser(this.user);
        }
        return null;
      },
    },

    storage: {
      get(this: AppContext): StorageService {
        return storage;
      },
    },

    taskWorker: {
      get(this: AppContext): RemoteInterface<TaskWorkerInterface> {
        return parent;
      },
    },

    dbConnection: {
      get(this: AppContext): DatabaseConnection {
        return dbConnection;
      },
    },
  };
}
