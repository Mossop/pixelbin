import { LoaderFunctionArgs, redirect } from "@remix-run/node";

import { safeLoader } from "@/modules/actions";
import { getSession } from "@/modules/session";
import { ApiRequest, apiFetch } from "@/modules/telemetry";

export const loader = safeLoader(
  async ({ request, params }: LoaderFunctionArgs) => {
    let init: ApiRequest = {
      method: "GET",
      redirect: "manual",
      headers: {},
    };

    let accept = request.headers.get("Accept");
    if (accept) {
      init.headers!.Accept = accept;
    }

    let session = await getSession(request);
    let token = session.get("token");
    if (token) {
      init.headers!.Authorization = `Bearer ${token}`;
    }

    let response = await apiFetch(`/media/${params["*"]}`, init);

    if (response.status >= 300 && response.status < 400) {
      let location = response.headers.get("location");
      if (location) {
        return redirect(location);
      }
    }

    return response;
  },
);
