import { Attributes, Context, SpanKind } from "@opentelemetry/api";
import { Request as ExpressRequest } from "express";

declare module "react-router" {
  interface AppLoadContext {
    expressRequest: ExpressRequest;
  }
}

declare global {
  interface SpanConfig {
    name: string;
    parentContext?: Context;
    kind?: SpanKind;
    attributes?: Attributes;
  }
}
