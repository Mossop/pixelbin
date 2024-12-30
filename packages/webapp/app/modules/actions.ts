import { ResponseError } from "./api";

function fixError(e: unknown): unknown {
  if (e instanceof ResponseError) {
    return e.response;
  }

  if (e instanceof Error) {
    return new Response(e.stack, { status: 500, statusText: e.message });
  }

  return new Response(String(e), {
    status: 500,
    statusText: "Internal Server Error",
  });
}

export function getFormString(formData: FormData, key: string): string {
  let value = formData.get(key);

  if (typeof value == "string") {
    return value;
  }

  throw new ResponseError(
    new Response(`Missing expected parameter: ${key}`, {
      status: 400,
      statusText: "Bad Request",
    }),
  );
}

export function safeAction<R, A>(
  action: (args: A) => Promise<R>,
): (args: A) => Promise<R> {
  return async (args: A) => {
    try {
      return await action(args);
    } catch (e) {
      throw fixError(e);
    }
  };
}

export function safeLoader<R, A>(
  loader: (args: A) => Promise<R>,
): (args: A) => Promise<R> {
  return async (args: A) => {
    try {
      return await loader(args);
    } catch (e) {
      throw fixError(e);
    }
  };
}
