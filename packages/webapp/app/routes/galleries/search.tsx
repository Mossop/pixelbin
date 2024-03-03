import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback } from "react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SearchBar from "@/components/SearchBar";
import { getSearch } from "@/modules/api";
import { getSession } from "@/modules/session";
import { SearchQuery } from "@/modules/types";
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
  let navigate = useNavigate();

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/search/${search.id}/media`, { signal }),
    [search],
  );

  let setQuery = useCallback(
    (query: SearchQuery) => {
      let params = new URLSearchParams({ q: JSON.stringify(query) });
      navigate(`${url(["catalog", search.catalog, "search"])}?${params}`);
    },
    [navigate],
  );

  return (
    <MediaGallery
      url={url(["search", search.id])}
      requestStream={requestStream}
    >
      <div className="search-gallery">
        <SearchBar searchQuery={search.query} setQuery={setQuery} />
        <div className="grid">
          <MediaGrid />
        </div>
      </div>
      <Outlet />
    </MediaGallery>
  );
}
