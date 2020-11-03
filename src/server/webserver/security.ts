import { Buffer } from "buffer";

import { nanoid } from "nanoid/async";

import { CSRF_COOKIE, CSRF_HEADER } from "../../model";
import type { AppContext, DescriptorsFor } from "./context";

export interface SecurityContext {
  readonly nonce: Promise<string>;
  readonly setCsrfToken: () => Promise<void>;
  readonly verifyCsrfToken: () => Promise<boolean>;
}

let nonces = new WeakMap<AppContext, Promise<string>>();

async function generateNonce(): Promise<string> {
  return Buffer.from(await nanoid()).toString("base64");
}

export default function securityContext(): DescriptorsFor<SecurityContext> {
  return {
    nonce: {
      get(this: AppContext): Promise<string> {
        let nonce = nonces.get(this);
        if (nonce) {
          return nonce;
        }

        nonce = generateNonce();
        nonces.set(this, nonce);
        return nonce;
      },
    },

    setCsrfToken: {
      get(this: AppContext): () => Promise<void> {
        return async (): Promise<void> => {
          let token = this.session?.csrfToken;
          if (!token) {
            token = await nanoid();

            if (this.session) {
              this.session.csrfToken = token;
            }

            this.cookies.set(CSRF_COOKIE, token, {
              httpOnly: false,
              sameSite: true,
              overwrite: true,
            });
          }

          this.set(CSRF_HEADER, token);
        };
      },
    },

    verifyCsrfToken: {
      get(this: AppContext): () => Promise<boolean> {
        return async (): Promise<boolean> => {
          if (!this.session?.csrfToken) {
            this.logger.error("No CSRF token was provided.");
            return false;
          }

          if (this.session.csrfToken != this.get(CSRF_HEADER)) {
            this.logger.error("The CSRF token provided was incorrect.");
            return false;
          }

          return true;
        };
      },
    },
  };
}
