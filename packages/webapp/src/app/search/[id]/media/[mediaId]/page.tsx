import { Metadata } from "next";

import MediaLayout from "@/components/MediaLayout";
import { getSearch, getMedia } from "@/modules/api";
import { mediaTitle, serializeMediaView } from "@/modules/util";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  let media = await getMedia(decodeURIComponent(mediaId));
  let search = await getSearch(decodeURIComponent(id));

  let title = mediaTitle(media);

  return { title: title ? `${title} - ${search.name}` : search.name };
}

export default async function Media({
  params: { mediaId },
}: {
  params: { mediaId: string };
}) {
  let media = await getMedia(decodeURIComponent(mediaId));

  return <MediaLayout media={serializeMediaView(media)} />;
}
