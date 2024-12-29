import { getRequestContext } from "@/modules/RequestContext";
import { safeAction } from "@/modules/actions";
import { login } from "@/modules/api";

import type { Route } from "./+types/login";

export const action = safeAction(
  async ({ request, context }: Route.ActionArgs) => {
    let requestContext = await getRequestContext(request, context);
    let formData = await request.formData();
    let email = String(formData.get("email"));
    let password = String(formData.get("password"));

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
