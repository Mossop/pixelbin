import MediaGrid from "@/components/MediaGrid";
import { safeMetadata, safePage } from "@/components/NotFound";
import SidebarLayout from "@/components/SidebarLayout";
import { listAlbum } from "@/modules/api";
import { Metadata } from "next";

export const generateMetadata = safeMetadata(async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);

  let album = await listAlbum(id);

  return { title: album.name };
});

export default safePage(async function Album({
  params: { id },
}: {
  params: { id: string };
}) {
  id = decodeURIComponent(id);

  let album = await listAlbum(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid base={["album", id]} media={album.media} />
    </SidebarLayout>
  );
});
