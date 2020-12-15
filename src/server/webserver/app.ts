import { promises as fs } from "fs";
import http, { STATUS_CODES } from "http";
import path from "path";

import type { RouterParamContext } from "@koa/router";
import Router from "@koa/router";
import csp from "content-security-policy-builder";
import type { DefaultState, DefaultContext } from "koa";
import Koa from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import type { Api, ApiSerialization } from "../../model";
import { Method, ErrorCode } from "../../model";
import { alternate, original, thumbnail } from "./api/media";
import { apiRequestHandler } from "./api/methods";
import { buildState } from "./api/state";
import type { AppContext, ServicesContext } from "./context";
import { buildContext } from "./context";
import { errorHandler, ApiError } from "./error";
import type { WebserverConfig } from "./interfaces";
import { APP_PATHS } from "./paths";
import Services, { provideService } from "./services";

async function buildAppContent(
  config: WebserverConfig,
  nonce: string,
  state: ApiSerialization<Api.State>,
): Promise<string> {
  if (process.env.NODE_ENV == "test") {
    return `<html>
<head>
<script id="initial-state" type="application/json">${JSON.stringify(state)}</script>
</head>
</html>`;
  }

  let base = path.resolve(path.dirname(path.dirname(__dirname)));

  let staticHash = await fs.readFile(path.join(base, "static", "hash.txt"), {
    encoding: "utf8",
  });

  let content = await fs.readFile(path.join(base, "index.html"), { encoding: "utf8" });
  return content
    .replace("{% paths %}", JSON.stringify({
      ...APP_PATHS,
      static: `${APP_PATHS.static}${staticHash}/`,
    }))
    .replace("{% state %}", JSON.stringify(state))
    .replace(/\{% nonce %\}/g, nonce)
    .replace(/ integrity="null"/g, "");
}

export type RouterContext<C> = C & RouterParamContext<DefaultState, C>;
type App = Koa<DefaultState, DefaultContext & ServicesContext>;

async function notFound(ctx: AppContext): Promise<void> {
  ctx.status = 404;
  ctx.message = STATUS_CODES[404] ?? "Unknown status";
  ctx.set("Content-Type", "text/plain");
  ctx.body = "Not found";
}

export default async function buildApp(): Promise<void> {
  let parent = await Services.parent;
  let config = await parent.getConfig();
  let context = await buildContext(config);
  let cache = await Services.cache;

  let base = path.resolve(path.dirname(path.dirname(__dirname)));

  let router = new Router<DefaultState, AppContext>();

  router.get("/healthcheck", async (ctx: AppContext): Promise<void> => {
    ctx.body = "Ok";
  });

  for (let method of Object.values(Method)) {
    router.all(`${APP_PATHS.api}${method}`, koaBody({
      multipart: true,
      parsedMethods: ["POST", "PUT", "PATCH", "DELETE"],
      formidable: {
        maxFileSize: 400 * 1024 * 1024,
      },
    }), apiRequestHandler(method));
  }

  router.get(
    `${APP_PATHS.root}media/:id/:file/thumb/:size/:encoding/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, size, file, encoding } = ctx.params;
      return thumbnail(ctx, id, file, encoding, size);
    },
  );

  router.get(
    `${APP_PATHS.root}search/:search/media/:id/:file/thumb/:size/:encoding/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, size, file, encoding, search } = ctx.params;
      return thumbnail(ctx, id, file, encoding, size, search);
    },
  );

  router.get(
    `${APP_PATHS.root}media/:id/:file/encoding/:encoding/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, encoding, file } = ctx.params;
      return alternate(ctx, id, file, encoding);
    },
  );

  router.get(
    `${APP_PATHS.root}search/:search/media/:id/:file/encoding/:encoding/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, encoding, file, search } = ctx.params;
      return alternate(ctx, id, file, encoding, search);
    },
  );

  router.get(
    `${APP_PATHS.root}media/:id/:file/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, file } = ctx.params;
      return original(ctx, id, file);
    },
  );

  router.get(
    `${APP_PATHS.root}search/:search/media/:id/:file/:filename`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, file, search } = ctx.params;
      return original(ctx, id, file, search);
    },
  );

  let staticRoot = path.join(base, "static");
  let staticHash = "";

  try {
    staticHash = await fs.readFile(path.join(staticRoot, "hash.txt"), {
      encoding: "utf8",
    }) + "/";
  } catch (e) {
    // Testing most likely.
  }

  let app = new Koa() as App;
  app.keys = config.secretKeys;

  Object.defineProperties(app.context, {
    ...context,
  });

  let allowedHosts = new Set(config.hosts);

  app
    .use(async (ctx: AppContext, next: Koa.Next): Promise<void> => {
      let start = Date.now();
      await next();
      let ms = Date.now() - start;

      ctx.set("X-Response-Time", `${ms}ms`);
      ctx.set("X-Worker-Id", String(process.pid));

      ctx.logger.info({
        duration: ms,
        status: ctx.response.status,
      });
    })

    .use(errorHandler)

    .use(async (ctx: AppContext, next: Koa.Next): Promise<void> => {
      let host = ctx.get("Host").replace(/:.*/, "");

      if (allowedHosts.has(host)) {
        return next();
      }

      let isApi = ctx.path.startsWith(APP_PATHS.api);
      if (config.apiHost && isApi && host == config.apiHost) {
        return next();
      }

      throw new ApiError(ErrorCode.InvalidHost);
    })

    .use(
      mount(
        `${APP_PATHS.static}${staticHash}`,
        serve(staticRoot, {
          maxAge: 1000 * 60 * 60 * 365,
          immutable: true,
        }),
      ),
    )
    .use(mount(APP_PATHS.static, notFound))

    .use(mount(APP_PATHS.app, serve(path.join(base, "client"), {
      maxAge: 1000 * 60 * 60 * 365,
      immutable: true,
    })))
    .use(mount(APP_PATHS.app, notFound))

    .use(session({
      renew: true,
      store: cache.sessionStore,
      sameSite: "strict",
    }, app as unknown as Koa))

    .use(router.routes())
    .use(mount(APP_PATHS.api, notFound))
    .use(mount(`${APP_PATHS.root}media/`, notFound))

    .use(async (ctx: AppContext): Promise<void> => {
      // Apply the CSRF token to the cookies if needed.
      await ctx.setCsrfToken();
      let nonce = await ctx.nonce;

      let state = await buildState(ctx);
      if (ctx.host != "localhost" && !ctx.host.startsWith("localhost:")) {
        ctx.set(
          "Content-Security-Policy",
          csp({
            directives: {
              defaultSrc: ["'self'"],
              fontSrc: ["'self'", "fonts.gstatic.com"],
              scriptSrc: ["'self'", `'nonce-${nonce}'`],
              styleSrc: ["'self'", `'nonce-${nonce}'`],
              imgSrc: ["'self'", "http:", "https:"],
              mediaSrc: ["'self'", "http:", "https:"],
            },
          }),
        );
      }
      ctx.set("Content-Type", "text/html; charset=utf-8");
      ctx.body = await buildAppContent(config, nonce, state);
    });

  provideService("server", http.createServer(app.callback()));
}
