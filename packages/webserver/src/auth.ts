import Koa, { Context } from "koa";
import * as Db from "pixelbin-database";
import { User } from "pixelbin-object-model";

export interface AuthContext {
  user: User | null;
  isLoggedIn: () => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export default function<S, C>(app: Koa<S, C>): Koa<S, C & AuthContext> {
  Object.defineProperties(app.context, {
    user: {
      get(this: Context & AuthContext): User | null {
        if (!this.session) {
          throw new Error("Session not correctly implemented.");
        }

        if (this.session.user) {
          return this.session.user as User;
        }
        return null;
      },
    },

    isLoggedIn: {
      get(this: Context & AuthContext): () => boolean {
        return (): boolean => !!this.user;
      },
    },

    login: {
      get(this: Context & AuthContext): (email: string, password: string) => Promise<void> {
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
            throw new Error("Incorrect credentials.");
          }
        };
      },
    },

    logout: {
      get(this: Context & AuthContext): () => Promise<void> {
        return async (): Promise<void> => {
          if (!this.session) {
            return;
          }

          delete this.session.user;
          this.session.save();
        };
      },
    },
  });

  return app as unknown as Koa<S, C & AuthContext>;
}
