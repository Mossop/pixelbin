import { ObjectModel, Api } from "../../model";
import { UserScopedConnection } from "../database";
import { AppContext, DescriptorsFor } from "./context";
import { ApiError } from "./error";

export interface AuthContext {
  readonly user: ObjectModel.User | null;
  readonly isLoggedIn: () => boolean;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
}

export default function(): DescriptorsFor<AuthContext> {
  return {
    user: {
      get(this: AppContext): ObjectModel.User | null {
        if (!this.session) {
          throw new Error("Session not correctly implemented.");
        }

        if (this.session.user) {
          return this.session.user as ObjectModel.User;
        }
        return null;
      },
    },

    isLoggedIn: {
      get(this: AppContext): () => boolean {
        return (): boolean => !!this.user;
      },
    },

    login: {
      get(this: AppContext): (email: string, password: string) => Promise<void> {
        return async (email: string, password: string): Promise<void> => {
          if (!this.session) {
            throw new Error("Session not correctly implemented.");
          }

          let user = await this.dbConnection.getUser(email, password);
          if (user) {
            this.session.user = user;
            this.session.save();
          } else {
            await this.logout();
            throw new ApiError(Api.ErrorCode.LoginFailed);
          }
        };
      },
    },

    logout: {
      get(this: AppContext): () => Promise<void> {
        return async (): Promise<void> => {
          if (!this.session) {
            return;
          }

          delete this.session.user;
          this.session.save();
        };
      },
    },
  };
}

export function ensureAuthenticated<A, R>(
  cb: (ctx: AppContext, userDb: UserScopedConnection, arg: A) => Promise<R>,
): (ctx: AppContext, arg: A) => Promise<R> {
  return async (ctx: AppContext, arg: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(Api.ErrorCode.NotLoggedIn);
    }

    return cb(ctx, userDb, arg);
  };
}

export function ensureAuthenticatedTransaction<A, R>(
  cb: (ctx: AppContext, userDb: UserScopedConnection, arg: A) => Promise<R>,
): (ctx: AppContext, arg: A) => Promise<R> {
  return async (ctx: AppContext, arg: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(Api.ErrorCode.NotLoggedIn);
    }

    return userDb.inTransaction((userDb: UserScopedConnection): Promise<R> => cb(ctx, userDb, arg));
  };
}
