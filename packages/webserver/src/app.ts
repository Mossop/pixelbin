import path from "path";

import Router from "@koa/router";
import Koa from "koa";
import mount from "koa-mount";
import serve from "koa-static";
import { ServerConfig } from "pixelbin-utils";

type Context = Koa.ParameterizedContext;
type Next = Koa.Next;

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

export default function buildApp(config: ServerConfig): Koa {
  const router = new Router();

  router.get("/healthcheck", async (ctx: Context): Promise<void> => {
    console.log(ctx.path);
    ctx.body = "Ok";
  });

  const app = new Koa();
  app.use(async (ctx: Context, next: Next): Promise<void> => {
    let start = Date.now();
    await next();
    let ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
  });

  app.use(async (ctx: Context, next: Next): Promise<void> => {
    await next();

    ctx.set("X-Worker-Id", String(process.pid));
  });

  app.use(router.routes());

  app.use(mount("/static", serve(path.join(config.staticRoot))));

  app.use(mount("/app", serve(path.join(config.appRoot))));

  app.use(async (ctx: Context): Promise<void> => {
    ctx.set("Content-Type", "text/html");
    ctx.body = buildAppContent();
  });

  return app;
}
