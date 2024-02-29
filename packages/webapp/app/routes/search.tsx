import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { useCallback, useMemo } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getCatalog } from "@/modules/api";
import { getSession } from "@/modules/session";
import { SearchQuery } from "@/modules/types";

export async function loader({ request, params: { id } }: LoaderFunctionArgs) {
  let session = await getSession(request);
  let catalog = await getCatalog(session, id!);

  return json({ title: catalog.name, catalog });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: `Search in ${data.title}` }];
  }
  return [];
};

export default function Search() {
  let { catalog } = useLoaderData<typeof loader>();
  let [searchParams] = useSearchParams();

  let [searchQuery, queryParam] = useMemo<[SearchQuery, string]>(() => {
    let param = searchParams.get("q");
    if (!param) {
      let query: SearchQuery = { queries: [] };
      return [query, JSON.stringify(query)];
    }
    return [JSON.parse(param), param];
  }, [searchParams]);

  let requestStream = useCallback(
    (signal: AbortSignal) => {
      let params = new URLSearchParams({ q: queryParam });
      return fetch(`/api/catalog/${catalog.id}/search?${params}`, { signal });
    },
    [catalog, queryParam],
  );

  return (
    <MediaGallery base={["catalog", catalog.id]} requestStream={requestStream}>
      <MediaGrid />
      <Outlet />
    </MediaGallery>
  );
}
