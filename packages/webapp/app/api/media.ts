import { redirect } from "react-router";

import { getRequestContext } from "@/modules/RequestContext";
import { safeLoader } from "@/modules/actions";
import { ApiRequest, apiResponse, forwardedRequest, GET } from "@/modules/api";

import { Route } from "./+types/media";

export const loader = safeLoader(
  async ({ request, context, params }: Route.LoaderArgs) => {
    let requestContext = await getRequestContext(request, context);
    let init: ApiRequest = GET();
    init.redirect = "manual";

    let accept = request.headers.get("Accept");
    if (accept) {
      init.headers.Accept = accept;
    }

    let token = requestContext.get("token");
    if (token) {
      init.headers.Authorization = `Bearer ${token}`;
    }

    let response = await apiResponse(
      `/media/${params["*"]}`,
      "media",
      () => init,
      forwardedRequest(requestContext),
    );

    if (response.status >= 300 && response.status < 400) {
      let location = response.headers.get("location");
      if (location) {
        return redirect(location);
      }
    }

    return response;
  },
);
