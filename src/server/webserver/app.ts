import path from "path";

import Router, { RouterParamContext } from "@koa/router";
import Koa, { DefaultState, DefaultContext } from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import { Api } from "../../model";
import { apiRequestHandler } from "./api/methods";
import { AppContext, ServicesContext, buildContext } from "./context";
import { errorHandler } from "./error";
import Services from "./services";

function buildAppContent(): string {
  return `
<!DOCTYPE html>

<html>
<head>
<title>PixelBin</title>
<link href="https://fonts.googleapis.com/css?family=Comfortaa" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://use.fontawesome.com/releases/v5.11.2/css/all.css" rel="stylesheet">
<script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>
<link rel="stylesheet" type="text/css" href="/app/css/app.css">
<script id="initial-state" type="application/json">{
  "user": null
}</script>
<script id="paths" type="application/json">{
  "root": "/",
  "static": "/static/",
  "api": "/api/"
}</script>
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

export default async function buildApp(): Promise<App> {
  let parent = await Services.parent;
  let config = await parent.getConfig();
  let context = await buildContext();

  const router = new Router<DefaultState, AppContext>();

  router.get("/healthcheck", async (ctx: AppContext): Promise<void> => {
    ctx.body = "Ok";
  });

  for (let method of Object.values(Api.Method)) {
    router.all(`/api/${method}`, koaBody({
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

    .use(mount("/static", serve(path.join(config.staticRoot))))

    .use(mount("/app", serve(path.join(config.appRoot))))

    .use(async (ctx: AppContext): Promise<void> => {
      ctx.set("Content-Type", "text/html");
      ctx.body = buildAppContent();
    });

  let server = await parent.getServer();
  app.listen(server);

  return app;
}
