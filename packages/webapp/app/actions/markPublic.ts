import { ActionFunctionArgs, json } from "@remix-run/node";

import { safeAction } from "@/modules/actions";
import { markMediaPublic } from "@/modules/api";
import { getSession } from "@/modules/session";

export const action = safeAction(async ({ request }: ActionFunctionArgs) => {
  let session = await getSession(request);
  let formData = await request.formData();
  let id = String(formData.get("id"));

  await markMediaPublic(session, id);

  return json({});
});
