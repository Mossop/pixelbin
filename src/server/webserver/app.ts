import { promises as fs } from "fs";
import { STATUS_CODES } from "http";

import Router, { RouterParamContext } from "@koa/router";
import Koa, { DefaultState, DefaultContext } from "koa";
import koaBody from "koa-body";
import mount from "koa-mount";
import session from "koa-session";
import serve from "koa-static";

import { Api, ResponseFor } from "../../model";
import { thumbnail } from "./api/media";
import { apiRequestHandler } from "./api/methods";
import { buildState } from "./api/state";
import { AppContext, ServicesContext, buildContext } from "./context";
import { errorHandler } from "./error";
import { APP_PATHS } from "./paths";
import Services from "./services";

async function buildAppContent(
  path: string,
  state: ResponseFor<Api.State>,
): Promise<string> {
  let content = await fs.readFile(path, { encoding: "utf8" });
  return content
    .replace("{% paths %}", JSON.stringify(APP_PATHS))
    .replace("{% state %}", JSON.stringify(state));
}

export type RouterContext<C> = C & RouterParamContext<DefaultState, C>;
type App = Koa<DefaultState, DefaultContext & ServicesContext>;

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

  router.get(
    `${APP_PATHS.root}media/thumbnail/:id/:original/:size(\\d+)?`,
    (ctx: RouterContext<AppContext>): Promise<void> => {
      let { id, original, size } = ctx.params;
      return thumbnail(ctx, id, original, size);
    },
  );

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
    .use(mount(`${APP_PATHS.root}media/`, notFound))

    .use(mount(APP_PATHS.static, serve(config.staticRoot)))
    .use(mount(APP_PATHS.static, notFound))

    .use(mount(APP_PATHS.app, serve(config.appRoot)))
    .use(mount(APP_PATHS.app, notFound))

    .use(async (ctx: AppContext): Promise<void> => {
      let state = await buildState(ctx);
      ctx.set("Content-Type", "text/html; charset=utf-8");
      ctx.body = await buildAppContent(config.htmlTemplate, state);
    });

  let server = await parent.getServer();
  app.listen(server);

  return app;
}
