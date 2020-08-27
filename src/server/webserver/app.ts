import path from "path";

import Router, { RouterParamContext } from "@koa/router";
import Koa, { DefaultState, DefaultContext } from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import { Api } from "../../model";
import { apiRequestHandler } from "./api/methods";
import { buildState } from "./api/state";
import { AppContext, ServicesContext, buildContext } from "./context";
import { errorHandler } from "./error";
import Services from "./services";

function buildAppContent(state: Api.State, paths: Record<string, string>): string {
  return `
<!DOCTYPE html>

<html>
<head>
<meta charset="utf-8">
<title>PixelBin</title>
<link href="https://fonts.googleapis.com/css?family=Comfortaa" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://use.fontawesome.com/releases/v5.11.2/css/all.css" rel="stylesheet">
<script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>
<link rel="stylesheet" type="text/css" href="/app/css/app.css">
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
    })

    .use(session({
      renew: true,
    }, app as unknown as Koa))

    .use(errorHandler)

    .use(router.routes())

    .use(mount(APP_PATHS.static, serve(path.join(config.staticRoot))))

    .use(mount(APP_PATHS.app, serve(path.join(config.appRoot))))

    .use(async (ctx: AppContext): Promise<void> => {
      let state = await buildState(ctx);
      ctx.set("Content-Type", "text/html; charset=utf-8");
      ctx.body = buildAppContent(state, APP_PATHS);
    });

  let server = await parent.getServer();
  app.listen(server);

  return app;
}
