import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { listCatalog } from "@/modules/api";
import { Metadata } from "next";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);

  let catalog = await listCatalog(id);

  return { title: catalog.name };
}

export default async function Catalog({
  params: { id },
}: {
  params: { id: string };
}) {
  id = decodeURIComponent(id);

  let catalog = await listCatalog(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid base={["catalog", id]} media={catalog.media} />
    </SidebarLayout>
  );
}
