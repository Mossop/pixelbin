import { ActionFunctionArgs, json } from "@remix-run/node";

import { safeAction } from "@/modules/actions";
import { subscribe } from "@/modules/api";
import { getRequestContext } from "@/modules/RequestContext";

export const action = safeAction(
  async ({ request, context }: ActionFunctionArgs) => {
    let requestContext = await getRequestContext(request, context);
    let formData = await request.formData();
    let email = String(formData.get("email"));
    let search = String(formData.get("search"));

    await subscribe(requestContext, email, search);

    return json({});
  },
);
