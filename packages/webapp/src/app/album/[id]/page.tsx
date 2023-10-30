import { Metadata } from "next";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { listAlbum } from "@/modules/api";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  let album = await listAlbum(decodeURIComponent(id));

  return { title: album.name };
}

export default async function Album({
  params: { id },
}: {
  params: { id: string };
}) {
  let album = await listAlbum(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid base={["album", id]} media={album.media} />
    </SidebarLayout>
  );
}
