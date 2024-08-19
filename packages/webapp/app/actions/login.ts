import { ActionFunctionArgs, json } from "@remix-run/node";

import { safeAction } from "@/modules/actions";
import { login } from "@/modules/api";
import { commitSession, getSession } from "@/modules/session";

export const action = safeAction(async ({ request }: ActionFunctionArgs) => {
  let session = await getSession(request);
  let formData = await request.formData();
  let email = String(formData.get("email"));
  let password = String(formData.get("password"));

  await login(session, email, password);

  return json(
    {},
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    },
  );
});
