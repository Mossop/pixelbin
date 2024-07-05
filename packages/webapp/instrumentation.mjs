import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { RemixInstrumentation } from "opentelemetry-instrumentation-remix";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

import dotenv from "dotenv";

dotenv.config();

if ("PIXELBIN_TELEMETRY_HOST" in process.env) {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: process.env.PIXELBIN_TELEMETRY_HOST,
    }),
    instrumentations: [
      new ExpressInstrumentation(),
      new RemixInstrumentation(),
    ],
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: "pixelbin",
    }),
  });

  sdk.start();
}
