import { Outlet, useSearchParams } from "react-router";
import { useCallback, useMemo } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SearchBar from "@/components/SearchBar";
import { getRequestContext } from "@/modules/RequestContext";
import { getCatalog } from "@/modules/api";
import { SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";
import { useHistoryState } from "@/modules/hooks";

import type { Route } from "./+types/index";

export async function loader({
  request,
  context,
  params: { id },
}: Route.LoaderArgs) {
  let session = await getRequestContext(request, context);
  let catalog = await getCatalog(session, id);

  return { title: catalog.name, catalog };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Search in ${data.title}` }];
}

export default function Search({
  loaderData: { catalog },
}: Route.ComponentProps) {
  let [searchParams, setSearchParams] = useSearchParams();
  let state = useHistoryState();

  let [searchQuery, queryParams] = useMemo<
    [SearchQuery, URLSearchParams]
  >(() => {
    let param = searchParams.get("q");
    if (!param) {
      let query: SearchQuery = { queries: [] };
      return [query, new URLSearchParams({ q: JSON.stringify(query) })];
    }
    return [
      JSON.parse(param) as SearchQuery,
      new URLSearchParams({ q: param }),
    ];
  }, [searchParams]);

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/catalog/${catalog.id}/search?${queryParams}`, { signal }),
    [catalog, queryParams],
  );

  let getMediaUrl = useCallback(
    (id: string) =>
      `${url(["catalog", catalog.id, "search", "media", id])}?${queryParams}`,
    [catalog, queryParams],
  );

  let galleryUrl = `${url(["catalog", catalog.id, "search"])}?${queryParams}`;

  let setQuery = useCallback(
    (query: SearchQuery) => {
      setSearchParams({ q: JSON.stringify(query) }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <MediaGallery
      key={`catalog/${catalog.id}/search`}
      type="search"
      url={galleryUrl}
      requestStream={requestStream}
      getMediaUrl={getMediaUrl}
    >
      <div className="search-gallery">
        <SearchBar
          catalog={catalog.id}
          searchQuery={searchQuery}
          setQuery={setQuery}
          initiallyExpanded={state?.expandSearchBar}
        />
        <div className="grid">
          <MediaGrid />
        </div>
      </div>
      <Outlet />
    </MediaGallery>
  );
}
