import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getCatalog } from "@/modules/api";
import { getSession } from "@/modules/session";
import { url } from "@/modules/util";

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

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/catalog/${catalog.id}/media`, { signal }),
    [catalog],
  );

  return (
    <MediaGallery
      url={url(["catalog", catalog.id])}
      requestStream={requestStream}
    >
      <MediaGrid />
      <Outlet />
    </MediaGallery>
  );
}
