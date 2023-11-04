import { Metadata } from "next";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { getCatalog } from "@/modules/api";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  let catalog = await getCatalog(decodeURIComponent(id));

  return { title: catalog.name };
}

export default async function Catalog({
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
