import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useCallback, useMemo } from "react";

import { HeaderButtons } from "@/components/AppBar";
import { IconLink } from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getRequestContext } from "@/modules/RequestContext";
import { getAlbum } from "@/modules/api";
import { AlbumField, SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

export async function loader({
  request,
  context,
  params: { id },
}: LoaderFunctionArgs) {
  let session = await getRequestContext(request, context);
  let album = await getAlbum(session, id!);

  return json({ title: album.name, album });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: data.title }];
  }
  return [];
};

export default function AlbumLayout() {
  let { album } = useLoaderData<typeof loader>();

  let requestStream = useCallback(
    (signal: AbortSignal) => fetch(`/api/album/${album.id}/media`, { signal }),
    [album],
  );

  let searchUrl = useMemo(() => {
    let query: SearchQuery = {
      queries: [
        {
          type: "album",
          queries: [
            {
              type: "field",
              field: AlbumField.Id,
              operator: "equal",
              value: album.id,
            },
          ],
        },
      ],
    };

    let params = new URLSearchParams({ q: JSON.stringify(query) });
    return url(["catalog", album.catalog, "search"], params);
  }, [album]);

  return (
    <>
      <HeaderButtons>
        <IconLink icon="search" to={searchUrl} />
      </HeaderButtons>
      <MediaGallery
        type="album"
        url={url(["album", album.id])}
        requestStream={requestStream}
      >
        <MediaGrid />
        <Outlet />
      </MediaGallery>
    </>
  );
}
