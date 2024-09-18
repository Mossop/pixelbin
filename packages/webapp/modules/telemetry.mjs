import { SpanStatusCode, trace, context } from "@opentelemetry/api";

/** @import { Span } from "@opentelemetry/api" */

/**
 * @template R
 * @template {(span: Span) => R} F
 * @param {string | SpanConfig} config
 * @param {F} task
 * @returns {R}
 */
export function inSpan(config, task) {
  /* @type {SpanConfig} */
  let spanConfig;
  if (typeof config == "string") {
    spanConfig = { name: config };
  } else {
    spanConfig = config;
  }

  let parentContext = spanConfig.parentContext ?? context.active();
  let options = {
    kind: spanConfig.kind,
    attributes: spanConfig.attributes,
  };

  return trace
    .getTracer("pixelbin")
    .startActiveSpan(spanConfig.name, options, parentContext, (span) => {
      try {
        let result = task(span);

        if (
          result &&
          typeof result == "object" &&
          "catch" in result &&
          "finally" in result
        ) {
          // @ts-expect-error Duck typed
          result = result
            .catch((e) => {
              span.recordException(e);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: String(e),
              });

              throw e;
            })
            .finally(() => span.end());
        } else {
          span.end();
        }

        return result;
      } catch (e) {
        span.recordException(e);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(e),
        });
        span.end();

        throw e;
      }
    });
}
