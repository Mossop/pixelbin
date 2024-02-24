import { ActionFunctionArgs, redirect } from "@remix-run/node";

import { destroySession, getSession } from "@/modules/session";

export async function action({ request }: ActionFunctionArgs) {
  let session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
