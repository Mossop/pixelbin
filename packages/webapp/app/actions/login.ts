import { ActionFunctionArgs, json } from "@remix-run/node";

import { getRequestContext } from "@/modules/RequestContext";
import { safeAction } from "@/modules/actions";
import { login } from "@/modules/api";

export const action = safeAction(
  async ({ request, context }: ActionFunctionArgs) => {
    let requestContext = await getRequestContext(request, context);
    let formData = await request.formData();
    let email = String(formData.get("email"));
    let password = String(formData.get("password"));

    await login(requestContext, email, password);

    return json(
      {},
      {
        headers: {
          "Set-Cookie": await requestContext.commit(),
        },
      },
    );
  },
);
