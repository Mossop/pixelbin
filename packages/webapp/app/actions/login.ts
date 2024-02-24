import { ActionFunctionArgs, json } from "@remix-run/node";

import { login } from "@/modules/api";
import { commitSession, getSession } from "@/modules/session";

export async function action({ request }: ActionFunctionArgs) {
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
    }
  );
}
