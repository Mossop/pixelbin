import { Context } from "koa";
import session from "koa-session";

import { DatabaseConnection, UserScopedConnection } from "../database";
import { StorageService } from "../storage";
import { RemoteInterface } from "../worker";
import authContext, { AuthContext } from "./auth";
import { Session, TaskWorkerInterface } from "./interfaces";
import loggingContext, { LoggingContext } from "./logging";
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
