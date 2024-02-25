import { useGalleryId } from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";

export default function CatalogGallery() {
  let id = useGalleryId();

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid />
    </SidebarLayout>
  );
}
