import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getSearch } from "@/modules/api";
import { getSession } from "@/modules/session";
import { url } from "@/modules/util";

export async function loader({ request, params: { id } }: LoaderFunctionArgs) {
  let session = await getSession(request);
  let search = await getSearch(session, id!);

  return json({ title: search.name, search });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: data.title }];
  }
  return [];
};

export default function SearchLayout() {
  let { search } = useLoaderData<typeof loader>();

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/search/${search.id}/media`, { signal }),
    [search],
  );

  return (
    <MediaGallery
      url={url(["search", search.id])}
      requestStream={requestStream}
    >
      <MediaGrid />
      <Outlet />
    </MediaGallery>
  );
}
