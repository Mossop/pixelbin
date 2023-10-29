import MediaLayout from "@/components/MediaLayout";
import { listAlbum } from "@/modules/api";
import { mediaTitle } from "@/modules/util";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);
  mediaId = decodeURIComponent(mediaId);

  let album = await listAlbum(id);

  let media = album.media.find((media) => media.id == mediaId);
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
  id = decodeURIComponent(id);
  mediaId = decodeURIComponent(mediaId);

  let album = await listAlbum(id);

  let media = album.media.find((media) => media.id == mediaId);
  if (!media) {
    notFound();
  }

  return <MediaLayout media={media} />;
}
