import { Span, trace } from "@opentelemetry/api";

export function inSpan<F extends (span: Span) => unknown>(
  name: string,
  task: F,
): ReturnType<F> {
  return trace
    .getTracer("nextjs-example")
    .startActiveSpan<(span: Span) => ReturnType<F>>(name, (span) => {
      let result = task(span) as ReturnType<F>;

      if (result && typeof result == "object" && "finally" in result) {
        // @ts-ignore
        result = result.finally(() => span.end());
      } else {
        span.end();
      }

      return result;
    });
}
