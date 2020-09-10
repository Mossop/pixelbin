import { STATUS_CODES } from "http";
import path from "path";

import Router, { RouterParamContext } from "@koa/router";
import Koa, { DefaultState, DefaultContext } from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import { Api, ResponseFor } from "../../model";
import { apiRequestHandler } from "./api/methods";
import { buildState } from "./api/state";
import { AppContext, ServicesContext, buildContext } from "./context";
import { errorHandler } from "./error";
// eslint-disable-next-line import/extensions
import packages from "./packages.json";
import Services from "./services";

interface Package {
  id: string;
  version: string;
  path: string;
}

function listScripts(): string {
  let scripts = packages.map((pkg: Package): string => {
    return "<script crossorigin " +
      `src="https://unpkg.com/${pkg.id}@${pkg.version}/${pkg.path}"></script>`;
  });

  return scripts.join("\n");
}

function buildAppContent(state: ResponseFor<Api.State>, paths: Record<string, string>): string {
  return `
<!DOCTYPE html>

<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width">
<title>PixelBin</title>
<link href="https://fonts.googleapis.com/css?family=Comfortaa" rel="stylesheet">
<link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap"
      rel="stylesheet">
${listScripts()}
<script id="initial-state" type="application/json">${JSON.stringify(state)}</script>
<script id="paths" type="application/json">${JSON.stringify(paths)}</script>
</head>
<body>
<div id="app"></div>
<script type="text/javascript" src="/app/js/app.js"></script>
</body>
</html>
`;
}

export type RouterContext<C> = C & RouterParamContext<DefaultState, C>;
type App = Koa<DefaultState, DefaultContext & ServicesContext>;

const APP_PATHS = {
  "root": "/",
  "static": "/static/",
  "api": "/api/",
  "app": "/app/",
};

async function notFound(ctx: AppContext): Promise<void> {
  ctx.status = 404;
  ctx.message = STATUS_CODES[404] ?? "Unknown status";
  ctx.set("Content-Type", "text/plain");
  ctx.body = "Not found";
}

export default async function buildApp(): Promise<App> {
  let parent = await Services.parent;
  let config = await parent.getConfig();
  let context = await buildContext();

  const router = new Router<DefaultState, AppContext>();

  router.get("/healthcheck", async (ctx: AppContext): Promise<void> => {
    ctx.body = "Ok";
  });

  for (let method of Object.values(Api.Method)) {
    router.all(`${APP_PATHS.api}${method}`, koaBody({
      multipart: true,
      parsedMethods: ["POST", "PUT", "PATCH", "DELETE"],
    }), apiRequestHandler(method));
  }

  const app = new Koa() as App;
  app.keys = config.secretKeys;

  Object.defineProperties(app.context, {
    ...context,
  });

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

    .use(session({
      renew: true,
    }, app as unknown as Koa))

    .use(errorHandler)

    .use(router.routes())
    .use(mount(APP_PATHS.api, notFound))

    .use(mount(APP_PATHS.static, serve(path.join(config.staticRoot))))
    .use(mount(APP_PATHS.static, notFound))

    .use(mount(APP_PATHS.app, serve(path.join(config.appRoot))))
    .use(mount(APP_PATHS.app, notFound))

    .use(async (ctx: AppContext): Promise<void> => {
      let state = await buildState(ctx);
      ctx.set("Content-Type", "text/html; charset=utf-8");
      ctx.body = buildAppContent(state, APP_PATHS);
    });

  let server = await parent.getServer();
  app.listen(server);

  return app;
}
