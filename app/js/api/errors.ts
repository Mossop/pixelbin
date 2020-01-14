import { JsonDecoder } from "ts.data.json";

import { L10nArgs, LocalizedProps, l10nAttributes } from "../l10n";

export interface APIError {
  status: number;
  statusText: string;
  code: string;
  args?: L10nArgs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: any;
}

const L10nArgsDecoder = JsonDecoder.dictionary<string | number>(
  JsonDecoder.oneOf<string | number>([
    JsonDecoder.number,
    JsonDecoder.string,
  ], "string | number"),
  "Args"
);

export function errorL10n(error: APIError): LocalizedProps {
  return l10nAttributes(`api-error-${error.code}`, error.args);
}

export async function decodeAPIError(response: Response): Promise<APIError> {
  let data = await response.json();

  let decoder = JsonDecoder.object<APIError>({
    status: JsonDecoder.constant(response.status),
    statusText: JsonDecoder.constant(response.statusText),
    code: JsonDecoder.string,
    args: JsonDecoder.optional(L10nArgsDecoder),
    detail: JsonDecoder.succeed,
  },
  "APIError");

  try {
    return await decoder.decodePromise(data);
  } catch (e) {
    let error: APIError = {
      status: 0,
      statusText: "Error parse failed",
      code: "error-parse-failed",
      args: {
        detail: String(e),
      }
    };
    return error;
  }
}
