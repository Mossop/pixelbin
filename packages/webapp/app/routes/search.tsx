import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { useCallback, useMemo } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SearchBar from "@/components/SearchBar";
import { getCatalog } from "@/modules/api";
import { getSession } from "@/modules/session";
import { SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

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

  let [searchQuery, queryParams] = useMemo<
    [SearchQuery, URLSearchParams]
  >(() => {
    let param = searchParams.get("q");
    if (!param) {
      let query: SearchQuery = { queries: [] };
      return [query, new URLSearchParams({ q: JSON.stringify(query) })];
    }
    return [JSON.parse(param), new URLSearchParams({ q: param })];
  }, [searchParams]);

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/catalog/${catalog.id}/search?${queryParams}`, { signal }),
    [catalog, queryParams],
  );

  let getMediaUrl = useCallback(
    (id: string) =>
      `${url(["catalog", catalog.id, "search", "media", id])}?${queryParams}`,
    [queryParams],
  );

  let galleryUrl = `${url(["catalog", catalog.id, "search"])}?${queryParams}`;

  return (
    <MediaGallery
      url={galleryUrl}
      requestStream={requestStream}
      getMediaUrl={getMediaUrl}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <SearchBar searchQuery={searchQuery} />
        <div style={{ flex: 1, overflowY: "auto" }}>
          <MediaGrid />
        </div>
      </div>
      <Outlet />
    </MediaGallery>
  );
}
