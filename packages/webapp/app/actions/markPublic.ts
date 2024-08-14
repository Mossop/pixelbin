import { ActionFunctionArgs, json } from "@remix-run/node";

import { markMediaPublic } from "@/modules/api";
import { getSession } from "@/modules/session";

export async function action({ request }: ActionFunctionArgs) {
  let session = await getSession(request);
  let formData = await request.formData();
  let id = String(formData.get("id"));

  await markMediaPublic(session, id);

  return json({});
}
