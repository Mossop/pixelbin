import { Metadata } from "next";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { listSearch } from "@/modules/api";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  let search = await listSearch(decodeURIComponent(id));

  return { title: search.name };
}

export default async function Search({
  params: { id },
}: {
  params: { id: string };
}) {
  let search = await listSearch(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid base={["search", id]} media={search.media} />
    </SidebarLayout>
  );
}
