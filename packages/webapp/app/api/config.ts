import { ApiRequest, apiFetch } from "@/modules/telemetry";

export async function loader() {
  let init: ApiRequest = {
    method: "GET",
  };

  let response = await apiFetch("/api/config", init);

  if (response.status <= 200 || response.status >= 300) {
    return response;
  }

  let config = await response.json();
  if ("SOURCE_CHANGESET" in process.env) {
    config.webappChangeset = process.env.SOURCE_CHANGESET;
  }

  return new Response(JSON.stringify(config));
}
