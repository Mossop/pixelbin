import { Span, SpanStatusCode, trace, context } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

export function inSpan<F extends (span: Span) => unknown>(
  name: string,
  task: F,
): ReturnType<F> {
  return trace
    .getTracer("pixelbin")
    .startActiveSpan<(span: Span) => ReturnType<F>>(name, (span) => {
      try {
        let result = task(span) as ReturnType<F>;

        if (
          result &&
          typeof result == "object" &&
          "catch" in result &&
          "finally" in result
        ) {
          // @ts-expect-error Duck typed
          result = result
            .catch((e: unknown) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
              });

              throw e;
            })
            .finally(() => span.end());
        } else {
          span.end();
        }

        return result;
      } catch (e) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
        });
        span.end();

        throw e;
      }
    });
}

export type ApiRequest = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export function apiFetch(path: string, init: ApiRequest): Promise<Response> {
  const method = init.method ?? "GET";

  return inSpan(`API ${method} ${path}`, async (span: Span) => {
    span.setAttributes({
      "http.method": method,
      "url.path": path,
      "span.kind": "client",
    });

    const realInit = {
      ...init,
      headers: init.headers ?? {},
    };

    const propagator = new W3CTraceContextPropagator();
    propagator.inject(context.active(), realInit.headers, {
      set(headers: Record<string, string>, key: string, value: string) {
        // eslint-disable-next-line no-param-reassign
        headers[key] = value;
      },
    });

    const response = await fetch(`${process.env.PXL_API_URL}${path}`, realInit);

    span.setAttribute("http.response.status_code", response.status);

    if (!response.ok) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }

    return response;
  });
}
