import { getRequestContext } from "@/modules/RequestContext";
import { safeLoader } from "@/modules/actions";
import { ApiConfig, apiResponse, forwardedRequest } from "@/modules/api";

import type { Route } from "./+types/config";

export const loader = safeLoader(
  async ({ request, context }: Route.LoaderArgs) => {
    let requestContext = await getRequestContext(request, context);
    let response = await apiResponse(
      "/api/config",
      "config",
      forwardedRequest(requestContext),
    );

    if (response.status < 200 || response.status >= 300) {
      return response;
    }

    let config = (await response.json()) as unknown as ApiConfig;
    if ("SOURCE_CHANGESET" in process.env) {
      config.webappChangeset = process.env.SOURCE_CHANGESET;
    }

    return new Response(JSON.stringify(config), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
);
