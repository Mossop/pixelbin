import { session } from "@/modules/session";

export async function GET(
  request: Request,
  { params: { path } }: { params: { path: string[] } },
) {
  let init: RequestInit = {
    method: "GET",
    redirect: "manual",
  };

  let token = await session();
  if (token) {
    init.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  return fetch(`${process.env.PXL_API_SERVER}/media/${path.join("/")}`, init);
}
