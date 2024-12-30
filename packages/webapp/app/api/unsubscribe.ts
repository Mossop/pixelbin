import { redirect } from "react-router";

import { safeLoader } from "@/modules/actions";
import { cancelSubscription } from "@/modules/api";
import { getRequestContext } from "@/modules/RequestContext";

import { Route } from "./+types/unsubscribe";

export const loader = safeLoader(
  async ({ request, context }: Route.LoaderArgs) => {
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
