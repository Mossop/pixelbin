import { Metadata } from "next";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { getAlbum } from "@/modules/api";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  let album = await getAlbum(decodeURIComponent(id));

  return { title: album.name };
}

export default async function Album({
  params: { id },
}: {
  params: { id: string };
}) {
  return (
    <SidebarLayout selectedItem={decodeURIComponent(id)}>
      <MediaGrid />
    </SidebarLayout>
  );
}
