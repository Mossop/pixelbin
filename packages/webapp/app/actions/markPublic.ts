import { getRequestContext } from "@/modules/RequestContext";
import { getFormString, safeAction } from "@/modules/actions";
import { markMediaPublic } from "@/modules/api";

import type { Route } from "./+types/login";

export const action = safeAction(
  async ({ request, context }: Route.ActionArgs) => {
    let requestContext = await getRequestContext(request, context);
    let formData = await request.formData();
    let id = getFormString(formData, "id");

    await markMediaPublic(requestContext, id);

    return {};
  },
);
