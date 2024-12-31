import { Outlet } from "react-router";
import { useCallback } from "react";

import { IconLink } from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getRequestContext } from "@/modules/RequestContext";
import { getCatalog } from "@/modules/api";
import { SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

import type { Info, Route } from "./+types/index";

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
  if (data) {
    return [{ title: data.title }];
  }
  return [];
}

export const handle = {
  headerButtons(data: Info["loaderData"]) {
    let query: SearchQuery = {
      queries: [],
    };

    if (data) {
      let params = new URLSearchParams({ q: JSON.stringify(query) });
      return (
        <IconLink
          icon="search"
          to={url(["catalog", data.catalog.id, "search"], params)}
        />
      );
    }
    return null;
  },
};

export default function CatalogLayout({ loaderData }: Route.ComponentProps) {
  let catalog = loaderData?.catalog;

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/catalog/${catalog.id}/media`, { signal }),
    [catalog],
  );

  if (catalog) {
    return (
      <MediaGallery
        type="catalog"
        url={url(["catalog", catalog.id])}
        requestStream={requestStream}
      >
        <MediaGrid />
        <Outlet />
      </MediaGallery>
    );
  }

  return <Outlet />;
}
