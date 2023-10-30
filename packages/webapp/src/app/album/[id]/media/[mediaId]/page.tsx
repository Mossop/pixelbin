import { Metadata } from "next";
import { notFound } from "next/navigation";

import MediaLayout from "@/components/MediaLayout";
import { listAlbum } from "@/modules/api";
import { mediaTitle } from "@/modules/util";

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
  let dMediaId = decodeURIComponent(mediaId);

  let album = await listAlbum(decodeURIComponent(id));

  let media = album.media.find((m) => m.id == dMediaId);
  if (!media) {
    notFound();
  }

  return <MediaLayout media={media} />;
}
