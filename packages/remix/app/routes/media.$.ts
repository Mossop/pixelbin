import { LoaderFunctionArgs } from "@remix-run/node";

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

  return apiFetch(`/media/${params["*"]}`, init);
}
