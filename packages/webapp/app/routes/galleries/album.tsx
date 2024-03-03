import {
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
  json,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";

import { IconLink } from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import { getAlbum } from "@/modules/api";
import { getSession } from "@/modules/session";
import { AlbumField, SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";

export async function loader({ request, params: { id } }: LoaderFunctionArgs) {
  let session = await getSession(request);
  let album = await getAlbum(session, id!);

  return json({ title: album.name, album });
}

export const handle = {
  headerButtons(data: SerializeFrom<typeof loader>) {
    let query: SearchQuery = {
      queries: [
        {
          type: "album",
          queries: [
            {
              type: "field",
              field: AlbumField.Id,
              operator: "equal",
              value: data.album.id,
            },
          ],
        },
      ],
    };

    let params = new URLSearchParams({ q: JSON.stringify(query) });
    return (
      <IconLink
        icon="search"
        to={url(["catalog", data.album.catalog, "search"], params)}
      />
    );
  },
};

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

  return (
    <MediaGallery url={url(["album", album.id])} requestStream={requestStream}>
      <MediaGrid />
      <Outlet />
    </MediaGallery>
  );
}
