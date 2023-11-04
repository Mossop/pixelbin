import { Metadata } from "next";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { getSearch } from "@/modules/api";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  let search = await getSearch(decodeURIComponent(id));

  return { title: search.name };
}

export default async function Search({
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
