import { Metadata } from "next";
import { notFound } from "next/navigation";

import MediaLayout from "@/components/MediaLayout";
import { listAlbum } from "@/modules/api";
import { mediaDate, mediaTitle } from "@/modules/util";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  let dMediaId = decodeURIComponent(mediaId);
  let album = await listAlbum(decodeURIComponent(id));

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
  let album = await listAlbum(decodeURIComponent(id));
  let gallery = album.media.toSorted(
    (a, b) => mediaDate(b).toMillis() - mediaDate(a).toMillis(),
  );

  return (
    <MediaLayout gallery={gallery} mediaId={decodeURIComponent(mediaId)} />
  );
}
