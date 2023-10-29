import MediaGrid from "@/components/MediaGrid";
import { safeMetadata, safePage } from "@/components/NotFound";
import SidebarLayout from "@/components/SidebarLayout";
import { listCatalog } from "@/modules/api";
import { Metadata } from "next";

export const generateMetadata = safeMetadata(async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);

  let catalog = await listCatalog(id);

  return { title: catalog.name };
});

export default safePage(async function Catalog({
  params: { id },
}: {
  params: { id: string };
}) {
  id = decodeURIComponent(id);

  let catalog = await listCatalog(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid media={catalog.media} />
    </SidebarLayout>
  );
});
