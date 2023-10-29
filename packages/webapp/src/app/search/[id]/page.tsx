import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { listSearch } from "@/modules/api";
import { Metadata } from "next";

export async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);

  let search = await listSearch(id);

  return { title: search.name };
}

export default async function Search({
  params: { id },
}: {
  params: { id: string };
}) {
  id = decodeURIComponent(id);

  let search = await listSearch(id);

  return (
    <SidebarLayout selectedItem={id}>
      <MediaGrid media={search.media} />
    </SidebarLayout>
  );
}
