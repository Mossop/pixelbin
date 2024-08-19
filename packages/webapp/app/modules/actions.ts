import {
  ActionFunction,
  ActionFunctionArgs,
  LoaderFunction,
  LoaderFunctionArgs,
} from "@remix-run/node";

function fixError(e: unknown): unknown {
  if (e instanceof Response) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    return e;
  }

  if (e instanceof Error) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    return new Response(e.stack, { status: 500, statusText: e.message });
  }

  /* @ts-ignore */
  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  return new Response(e.toString(), {
    status: 500,
    statusText: "Internal Server Error",
  });
}

export function safeAction(action: ActionFunction): ActionFunction {
  return async (args: ActionFunctionArgs) => {
    try {
      return await action(args);
    } catch (e) {
      throw fixError(e);
    }
  };
}

export function safeLoader(loader: LoaderFunction): LoaderFunction {
  return async (args: LoaderFunctionArgs) => {
    try {
      return await loader(args);
    } catch (e) {
      throw fixError(e);
    }
  };
}
