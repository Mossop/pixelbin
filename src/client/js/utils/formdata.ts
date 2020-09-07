import { exception, ErrorCode } from "./exception";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject = (data: any): data is Record<string, any> => typeof data == "object";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isArray = (data: any): data is any[] => Array.isArray(data);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function intoString(data: any): string {
  return String(data);
}

function *objectParams(
  data: Record<string, unknown>,
  prefix: string = "",
): Generator<[string, string | Blob]> {
  for (let [key, value] of Object.entries(data)) {
    let param = `${prefix}${key}`;
    if (value instanceof Blob) {
      yield [param, value];
    } else if (isArray(value)) {
      yield* arrayParams(value, param);
    } else if (isObject(value)) {
      yield* objectParams(value, `${param}.`);
    } else {
      yield [param, intoString(value)];
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function *arrayParams(data: any[], prefix: string = ""): Generator<[string, string | Blob]> {
  for (let [index, value] of data.entries()) {
    let param = `${prefix}[${index}]`;

    if (value instanceof Blob) {
      yield [param, value];
    } else if (isArray(value)) {
      yield* arrayParams(value, param);
    } else if (isObject(value)) {
      yield* objectParams(value, `${param}.`);
    } else {
      yield [param, intoString(value)];
    }
  }
}

export function *formParams(data: unknown): Generator<[string, string | Blob]> {
  if (isArray(data)) {
    yield* arrayParams(data);
  } else if (isObject(data)) {
    yield* objectParams(data);
  } else {
    exception(ErrorCode.InvalidData, {
      detail: `Unexpected data type ${typeof data}`,
    });
  }
}
