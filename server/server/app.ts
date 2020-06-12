import Router from "@koa/router";
import Koa from "koa";

type Context = Koa.ParameterizedContext;
type Next = Koa.Next;

export default function buildApp(): Koa {
  const router = new Router();

  router.get("/healthcheck", async (ctx: Context): Promise<void> => {
    ctx.body = "Ok";
  });

  router.get("/", async (ctx: Context): Promise<void> => {
    ctx.body = {
      status: "success",
      message: "hello, world!",
    };
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
  return app;
}

