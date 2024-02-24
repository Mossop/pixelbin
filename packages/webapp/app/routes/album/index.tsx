import { useRouteLoaderData } from "@remix-run/react";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { Album } from "@/modules/types";

export default function AlbumGallery() {
  let album = useRouteLoaderData("routes/album/layout") as Album;

  return (
    <SidebarLayout selectedItem={album.id}>
      <MediaGrid />
    </SidebarLayout>
  );
}
