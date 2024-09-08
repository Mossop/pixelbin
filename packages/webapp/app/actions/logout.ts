import { ActionFunctionArgs, redirect } from "@remix-run/node";

import { getRequestContext } from "@/modules/RequestContext";
import { safeAction } from "@/modules/actions";

export const action = safeAction(
  async ({ request, context }: ActionFunctionArgs) => {
    let session = await getRequestContext(request, context);

    return redirect("/", {
      headers: {
        "Set-Cookie": await session.destroy(),
      },
    });
  },
);
