import { Metadata } from "next";

import MediaLayout from "@/components/MediaLayout";
import { getCatalog, getMedia } from "@/modules/api";
import { mediaTitle, serializeMediaView } from "@/modules/util";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  let media = await getMedia(decodeURIComponent(mediaId));
  let catalog = await getCatalog(decodeURIComponent(id));

  let title = mediaTitle(media);

  return { title: title ? `${title} - ${catalog.name}` : catalog.name };
}

export default async function Media({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}) {
  let media = await getMedia(decodeURIComponent(mediaId));

  return (
    <MediaLayout
      gallery={["catalog", decodeURIComponent(id)]}
      fromGallery={true}
      media={serializeMediaView(media)}
    />
  );
}
