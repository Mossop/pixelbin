import { ObjectModel } from "../../model";
import * as Db from "../database";
import { AppContext } from "./app";
import { ApiError, ApiErrorCode } from "./error";

export interface AuthContext {
  user: ObjectModel.User | null;
  isLoggedIn: () => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export default function(): Record<string, PropertyDescriptor> {
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

          let user = await Db.getUser(email, password);
          if (user) {
            this.session.user = user;
            this.session.save();
          } else {
            await this.logout();
            throw new ApiError(ApiErrorCode.LoginFailed);
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
  cb: (ctx: AppContext, user: ObjectModel.User, arg: A) => Promise<R>,
): (ctx: AppContext, arg: A) => Promise<R> {
  return async (ctx: AppContext, arg: A): Promise<R> => {
    let user = ctx.user;
    if (!user) {
      throw new ApiError(ApiErrorCode.NotLoggedIn);
    }

    return cb(ctx, user, arg);
  };
}
