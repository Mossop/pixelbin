import { Metadata } from "next";
import { notFound } from "next/navigation";

import MediaLayout from "@/components/MediaLayout";
import { getAlbum } from "@/modules/api";
import { mediaDate, mediaTitle } from "@/modules/util";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  let dMediaId = decodeURIComponent(mediaId);
  let album = await getAlbum(decodeURIComponent(id));

  let media = album.media.find((m) => m.id == dMediaId);
  if (!media) {
    notFound();
  }

  let title = mediaTitle(media);

  return { title: title ? `${title} - ${album.name}` : album.name };
}

export default async function Media({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}) {
  let album = await getAlbum(decodeURIComponent(id));

  // Note the inverse sort compared to the grid view
  let gallery = album.media.toSorted(
    (a, b) => mediaDate(a).toMillis() - mediaDate(b).toMillis(),
  );

  return (
    <MediaLayout
      base={["album", album.id]}
      gallery={gallery}
      mediaId={decodeURIComponent(mediaId)}
    />
  );
}
