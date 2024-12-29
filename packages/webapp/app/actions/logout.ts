import { redirect } from "react-router";

import { getRequestContext } from "@/modules/RequestContext";
import { safeAction } from "@/modules/actions";

import type { Route } from "./+types/login";

export const action = safeAction(
  async ({ request, context }: Route.ActionArgs) => {
    let requestContext = await getRequestContext(request, context);

    return redirect("/", {
      headers: {
        "Set-Cookie": await requestContext.destroy(),
      },
    });
  },
);
