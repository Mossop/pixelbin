import { ActionFunctionArgs, redirect } from "@remix-run/node";

import { safeLoader } from "@/modules/actions";
import { verifySubscription } from "@/modules/api";
import { getRequestContext } from "@/modules/RequestContext";

export const loader = safeLoader(
  async ({ request, context }: ActionFunctionArgs) => {
    let requestContext = await getRequestContext(request, context);

    let url = new URL(request.url);
    let token = url.searchParams.get("token");

    if (token) {
      await verifySubscription(requestContext, token);
    }

    return redirect("/");
  },
);
