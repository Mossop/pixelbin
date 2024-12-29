import {
  propagation,
  context,
  SpanStatusCode,
  SpanKind,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_URL_PATH,
  ATTR_USER_AGENT_ORIGINAL,
  ATTR_OTEL_STATUS_DESCRIPTION,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_OTEL_STATUS_CODE,
  ATTR_CLIENT_ADDRESS,
} from "@opentelemetry/semantic-conventions";
import { createRequestHandler } from "@react-router/express";
import dotenv from "dotenv";
import express from "express";

import { inSpan } from "./modules/telemetry.mjs";

dotenv.config();

function initTelemetry() {
  if ("PIXELBIN_TELEMETRY_HOST" in process.env) {
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: process.env.PIXELBIN_TELEMETRY_HOST,
      }),
      instrumentations: [],
      resource: new Resource({
        [ATTR_SERVICE_NAME]: "pixelbin",
      }),
    });

    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    sdk.start();
  }
}

/**
 * @param {express.Request} request
 * @returns {import("react-router").AppLoadContext}
 */
function getLoadContext(expressRequest) {
  return { expressRequest };
}

async function initServer() {
  let app = express();

  app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

  app.use(express.static("build/client", { maxAge: "1h" }));

  let requestHandler;

  // handle asset requests
  if (process.env.NODE_ENV === "production") {
    app.use(
      "/assets",
      express.static("build/client/assets", {
        immutable: true,
        maxAge: "1y",
      }),
    );

    requestHandler = createRequestHandler({
      build: await import("./build/server/index.js"),

      getLoadContext,
    });
  } else {
    let viteDevServer = await import("vite").then((vite) =>
      vite.createServer({
        server: { middlewareMode: true },
      }),
    );

    app.use(viteDevServer.middlewares);

    requestHandler = createRequestHandler({
      build: () =>
        viteDevServer.ssrLoadModule("virtual:react-router/server-build"),

      getLoadContext,
    });
  }

  app.all("*", (request, response, next) => {
    let parentContext = propagation.extract(context.active(), request.headers, {
      keys(headers) {
        return Object.keys(headers);
      },

      get(headers, key) {
        return headers[key];
      },
    });

    return inSpan(
      {
        name: `HTTP ${request.method}`,
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_URL_PATH]: request.path,
          [ATTR_CLIENT_ADDRESS]: request.ip,
          [ATTR_HTTP_REQUEST_METHOD]: request.method,
          [ATTR_USER_AGENT_ORIGINAL]: request.headers["user-agent"],
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: undefined,
          [ATTR_OTEL_STATUS_CODE]: SpanStatusCode.DEFAULT,
          [ATTR_OTEL_STATUS_DESCRIPTION]: undefined,
        },
        parentContext,
      },
      async () => requestHandler(request, response, next),
    );
  });

  return app;
}

async function main() {
  initTelemetry();
  let app = await initServer();

  let port = process.env.PIXELBIN_WEB_PORT ?? 3000;
  app.listen(port, () =>
    console.log(`Listening on http://localhost:${port}...`),
  );
}

main().catch(console.error);
