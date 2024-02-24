import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";

import MediaGallery from "@/components/MediaGallery";
import { getCatalog } from "@/modules/api";
import { getSession } from "@/modules/session";

export async function loader({ request, params: { id } }: LoaderFunctionArgs) {
  let session = await getSession(request);
  let catalog = await getCatalog(session, id!);

  return json({ title: catalog.name, catalog });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: data.title }];
  }
  return [];
};

export default function CatalogLayout() {
  let { catalog } = useLoaderData<typeof loader>();

  return (
    <MediaGallery type={"catalog"} id={catalog.id}>
      <Outlet />
    </MediaGallery>
  );
}