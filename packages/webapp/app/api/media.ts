import { LoaderFunctionArgs, redirect } from "@remix-run/node";

import { getRequestContext } from "@/modules/RequestContext";
import { safeLoader } from "@/modules/actions";
import { ApiRequest, apiResponse, forwardedRequest, GET } from "@/modules/api";

export const loader = safeLoader(
  async ({ request, context, params }: LoaderFunctionArgs) => {
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
