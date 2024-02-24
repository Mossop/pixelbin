import { useParams } from "@remix-run/react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";

export default function SearchGallery() {
  let { search } = useParams();
  return (
    <MediaGallery type={"search"} id={search!}>
      <SidebarLayout selectedItem={search!}>
        <MediaGrid />
      </SidebarLayout>
    </MediaGallery>
  );
}
