import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SearchBar from "@/components/SearchBar";
import { getRequestContext } from "@/modules/RequestContext";
import { getSearch } from "@/modules/api";
import { SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

export async function loader({
  request,
  context,
  params: { id },
}: LoaderFunctionArgs) {
  let session = await getRequestContext(request, context);
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
  let navigate = useNavigate();

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/search/${search.id}/media`, { signal }),
    [search],
  );

  let setQuery = useCallback(
    (query: SearchQuery) => {
      let params = new URLSearchParams({ q: JSON.stringify(query) });
      navigate(`${url(["catalog", search.catalog, "search"])}?${params}`, {
        state: { expandSearchBar: true },
      });
    },
    [navigate, search],
  );

  return (
    <MediaGallery
      type="savedSearch"
      url={url(["search", search.id])}
      requestStream={requestStream}
    >
      <div className="search-gallery">
        <SearchBar
          catalog={search.catalog}
          searchQuery={search.query}
          setQuery={setQuery}
        />
        <div className="grid">
          <MediaGrid />
        </div>
      </div>
      <Outlet />
    </MediaGallery>
  );
}
