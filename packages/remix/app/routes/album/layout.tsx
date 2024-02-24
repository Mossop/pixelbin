import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";

import MediaGallery from "@/components/MediaGallery";
import { getAlbum } from "@/modules/api";
import { getSession } from "@/modules/session";

export async function loader({ request, params: { id } }: LoaderFunctionArgs) {
  let session = await getSession(request);
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

  return (
    <MediaGallery type={"album"} id={album.id}>
      <Outlet />
    </MediaGallery>
  );
}
