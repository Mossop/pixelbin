import { ActionFunctionArgs, json } from "@remix-run/node";

import { getRequestContext } from "@/modules/RequestContext";
import { safeAction } from "@/modules/actions";
import { markMediaPublic } from "@/modules/api";

export const action = safeAction(
  async ({ request, context }: ActionFunctionArgs) => {
    let session = await getRequestContext(request, context);
    let formData = await request.formData();
    let id = String(formData.get("id"));

    await markMediaPublic(session, id);

    return json({});
  },
);
