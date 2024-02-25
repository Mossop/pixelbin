import { redirect } from "@remix-run/node";

import { ApiRequest, apiFetch } from "@/modules/telemetry";

export async function loader() {
  let init: ApiRequest = {
    method: "GET",
  };

  let response = await apiFetch("/api/config", init);

  if (response.status >= 300 && response.status < 400) {
    let location = response.headers.get("location");
    if (location) {
      return redirect(location);
    }
  }

  return response;
}
