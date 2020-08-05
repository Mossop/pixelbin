import path from "path";

import Router, { RouterParamContext } from "@koa/router";
import Koa, { DefaultState, Context, DefaultContext } from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import { Api } from "../../model";
import { RemoteInterface } from "../../worker";
import { apiRequestHandler } from "./api/methods";
import auth, { AuthContext } from "./auth";
import { errorHandler } from "./error";
import { ParentProcessInterface } from "./interfaces";
import logging, { LoggingContext } from "./logging";
import { ServicesContext, initServices } from "./services";

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

export type AddedContexts = AuthContext & LoggingContext & ServicesContext;
export type AppContext = Context & AddedContexts;
export type RouterContext<C> = C & RouterParamContext<DefaultState, C>;

export default async function buildApp(
  parent: RemoteInterface<ParentProcessInterface>,
): Promise<Koa<DefaultState, DefaultContext & AddedContexts>> {
  let config = await parent.getConfig();
  let services = await initServices(parent);

  const router = new Router<DefaultState, AppContext>();

  router.get("/healthcheck", async (ctx: AppContext): Promise<void> => {
    ctx.body = "Ok";
  });

  for (let method of Object.values(Api.Method)) {
    router.all(`/api/${method}`, koaBody({
      multipart: true,
    }), apiRequestHandler(method));
  }

  const app = new Koa<DefaultState, DefaultContext & AddedContexts>();
  app.keys = config.secretKeys;

  Object.defineProperties(app.context, {
    ...logging(),
    ...auth(),
    ...Object.getOwnPropertyDescriptors(services),
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
