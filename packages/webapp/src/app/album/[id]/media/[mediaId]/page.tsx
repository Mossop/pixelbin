import { Metadata } from "next";

import MediaLayout from "@/components/MediaLayout";
import { getAlbum, getMedia } from "@/modules/api";
import { mediaTitle, serializeMediaView } from "@/modules/util";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  let media = await getMedia(decodeURIComponent(mediaId));
  let album = await getAlbum(decodeURIComponent(id));

  let title = mediaTitle(media);

  return { title: title ? `${title} - ${album.name}` : album.name };
}

export default async function Media({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}) {
  let media = await getMedia(decodeURIComponent(mediaId));

  return (
    <MediaLayout
      gallery={["album", decodeURIComponent(id)]}
      media={serializeMediaView(media)}
    />
  );
}
