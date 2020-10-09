import { ObjectModel, ResponseFor, ErrorCode } from "../../model";
import { isoDateTime } from "../../utils";
import { UserScopedConnection } from "../database";
import { AppContext, DescriptorsFor } from "./context";
import { ApiError } from "./error";

export interface AuthContext {
  readonly user: ResponseFor<Omit<ObjectModel.User, "lastLogin">> | null;
  readonly isLoggedIn: () => boolean;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
}

export default function(): DescriptorsFor<AuthContext> {
  return {
    user: {
      get(this: AppContext): ResponseFor<ObjectModel.User> | null {
        if (!this.session) {
          throw new Error("Session not correctly implemented.");
        }

        if (this.session.user) {
          return this.session.user as ResponseFor<ObjectModel.User>;
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

          let user = await this.dbConnection.loginUser(email, password);
          if (user) {
            this.session.user = {
              ...user,
              created: isoDateTime(user.created),
            };
            this.session.save();
          } else {
            await this.logout();
            throw new ApiError(ErrorCode.LoginFailed);
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

export function ensureAuthenticated<A extends unknown[], R>(
  cb: (ctx: AppContext, userDb: UserScopedConnection, ...args: A) => Promise<R>,
): (ctx: AppContext, ...args: A) => Promise<R> {
  return async (ctx: AppContext, ...args: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    return cb(ctx, userDb, ...args);
  };
}

export function ensureAuthenticatedTransaction<A extends unknown[], R>(
  cb: (ctx: AppContext, userDb: UserScopedConnection, ...args: A) => Promise<R>,
): (ctx: AppContext, ...args: A) => Promise<R> {
  return async (ctx: AppContext, ...args: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    return userDb.inTransaction(
      (userDb: UserScopedConnection): Promise<R> => cb(ctx, userDb, ...args),
    );
  };
}
