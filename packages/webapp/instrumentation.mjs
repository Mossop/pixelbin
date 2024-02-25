import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { RemixInstrumentation } from "opentelemetry-instrumentation-remix";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Resource } from "@opentelemetry/resources";

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [new ExpressInstrumentation(), new RemixInstrumentation()],
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "pixelbin",
  }),
});

sdk.start();
