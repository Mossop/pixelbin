import { ErrorCode } from "../../model";
import type { UserScopedConnection } from "../database";
import type { AppContext, DescriptorsFor } from "./context";
import { ApiError } from "./error";

export interface AuthContext {
  readonly user: string | null;
  readonly isLoggedIn: () => boolean;
  readonly login: (email: string, password: string) => Promise<void>;
  readonly logout: () => Promise<void>;
}

export default function(): DescriptorsFor<AuthContext> {
  return {
    user: {
      get(this: AppContext): string | null {
        if (!this.session) {
          throw new Error("Session not correctly implemented.");
        }

        if (this.session.user) {
          return this.session.user;
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
            this.session.user = user.email;
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
  requireCsrfToken: boolean = true,
): (ctx: AppContext, ...args: A) => Promise<R> {
  return async (ctx: AppContext, ...args: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    if (requireCsrfToken && !await ctx.verifyCsrfToken()) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    return cb(ctx, userDb, ...args);
  };
}

export function ensureAuthenticatedTransaction<A extends unknown[], R>(
  cb: (ctx: AppContext, userDb: UserScopedConnection, ...args: A) => Promise<R>,
  requireCsrfToken: boolean = true,
): (ctx: AppContext, ...args: A) => Promise<R> {
  return async (ctx: AppContext, ...args: A): Promise<R> => {
    let userDb = ctx.userDb;
    if (!userDb) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    if (requireCsrfToken && !await ctx.verifyCsrfToken()) {
      throw new ApiError(ErrorCode.NotLoggedIn);
    }

    return userDb.inTransaction(
      cb.name,
      (userDb: UserScopedConnection): Promise<R> => cb(ctx, userDb, ...args),
    );
  };
}
