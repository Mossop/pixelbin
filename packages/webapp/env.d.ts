/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />
import { Attributes, Context, SpanKind } from "@opentelemetry/api";
import { Request as ExpressRequest } from "express";

declare module "@remix-run/node" {
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
