import { redirect } from "react-router";

import { safeLoader } from "@/modules/actions";
import { verifySubscription } from "@/modules/api";
import { getRequestContext } from "@/modules/RequestContext";

import { Route } from "./+types/subscribe";

export const loader = safeLoader(
  async ({ request, context }: Route.ActionArgs) => {
    let requestContext = await getRequestContext(request, context);

    let url = new URL(request.url);
    let token = url.searchParams.get("token");

    if (token) {
      await verifySubscription(requestContext, token);
    }

    return redirect("/");
  },
);
