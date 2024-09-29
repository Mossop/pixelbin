import { ActionFunctionArgs, redirect } from "@remix-run/node";

import { safeLoader } from "@/modules/actions";
import { cancelSubscription } from "@/modules/api";
import { getRequestContext } from "@/modules/RequestContext";

export const loader = safeLoader(
  async ({ request, context }: ActionFunctionArgs) => {
    let requestContext = await getRequestContext(request, context);

    let url = new URL(request.url);
    let email = url.searchParams.get("email");
    let search = url.searchParams.get("search");

    if (email) {
      await cancelSubscription(requestContext, email, search);
    }

    return redirect("/");
  },
);
