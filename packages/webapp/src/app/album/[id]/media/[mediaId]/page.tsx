import MediaLayout from "@/components/MediaLayout";
import { NotFoundError, safeMetadata, safePage } from "@/components/NotFound";
import { listAlbum } from "@/modules/api";
import { mediaTitle } from "@/modules/util";
import { Metadata } from "next";

export const generateMetadata = safeMetadata(async function generateMetadata({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);
  mediaId = decodeURIComponent(mediaId);

  let album = await listAlbum(id);

  let media = album.media.find((media) => media.id == mediaId);
  if (!media) {
    throw new NotFoundError();
  }

  let title = mediaTitle(media);

  return { title: title ? `${title} - ${album.name}` : album.name };
});

export default safePage(async function Media({
  params: { id, mediaId },
}: {
  params: { id: string; mediaId: string };
}) {
  id = decodeURIComponent(id);
  mediaId = decodeURIComponent(mediaId);

  let album = await listAlbum(id);

  let media = album.media.find((media) => media.id == mediaId);
  if (!media) {
    throw new NotFoundError();
  }

  return <MediaLayout media={media} />;
});
