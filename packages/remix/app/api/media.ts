import { LoaderFunctionArgs, redirect } from "@remix-run/node";

import { getSession } from "@/modules/session";
import { ApiRequest, apiFetch } from "@/modules/telemetry";

export async function loader({ request, params }: LoaderFunctionArgs) {
  let init: ApiRequest = {
    method: "GET",
    redirect: "manual",
  };

  let session = await getSession(request);
  let token = session.get("token");
  if (token) {
    init.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  let response = await apiFetch(`/media/${params["*"]}`, init);

  if (response.status >= 300 && response.status < 400) {
    let location = response.headers.get("location");
    if (location) {
      return redirect(location);
    }
  }

  return response;
}
