import { ActionFunctionArgs, redirect } from "@remix-run/node";

import { safeAction } from "@/modules/actions";
import { destroySession, getSession } from "@/modules/session";

export const action = safeAction(async ({ request }: ActionFunctionArgs) => {
  let session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
});
