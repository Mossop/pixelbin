import { getRequestContext } from "@/modules/RequestContext";
import { getFormString, safeAction } from "@/modules/actions";
import { login } from "@/modules/api";

import type { Route } from "./+types/login";

export const action = safeAction(
  async ({ request, context }: Route.ActionArgs) => {
    let requestContext = await getRequestContext(request, context);
    let formData = await request.formData();
    let email = getFormString(formData, "email");
    let password = getFormString(formData, "password");

    await login(requestContext, email, password);

    return Response.json(
      {},
      {
        headers: {
          "Set-Cookie": await requestContext.commit(),
        },
      },
    );
  },
);
