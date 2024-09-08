import {
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
  TypedResponse,
  json,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";

import { IconLink } from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getRequestContext } from "@/modules/RequestContext";
import { getCatalog, isNotFound } from "@/modules/api";
import { Catalog, SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

export async function loader({
  request,
  context,
  params: { id },
}: LoaderFunctionArgs): Promise<
  TypedResponse<{ title: string; catalog: Catalog } | null>
> {
  let session = await getRequestContext(request, context);
  if (session.isAuthenticated()) {
    try {
      let catalog = await getCatalog(session, id!);
      return json({ title: catalog.name, catalog });
    } catch (e: unknown) {
      if (!isNotFound(e)) {
        throw e;
      }
    }
  }

  return json(null);
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: data.title }];
  }
  return [];
};

export const handle = {
  headerButtons(data: SerializeFrom<typeof loader>) {
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

export default function CatalogLayout() {
  let catalog = useLoaderData<typeof loader>()?.catalog;

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/catalog/${catalog!.id}/media`, { signal }),
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
