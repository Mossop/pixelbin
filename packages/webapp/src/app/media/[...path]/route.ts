import { session } from "@/modules/session";
import { ApiRequest, apiFetch } from "@/modules/telemetry";

export async function GET(
  request: Request,
  { params: { path } }: { params: { path: string[] } },
) {
  let init: ApiRequest = {
    method: "GET",
    redirect: "manual",
  };

  let token = await session();
  if (token) {
    init.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  return apiFetch(`/media/${path.join("/")}`, init);
}
