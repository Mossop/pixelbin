import MediaGrid from "@/components/MediaGrid";
import { safeMetadata, safePage } from "@/components/NotFound";
import SidebarLayout from "@/components/SidebarLayout";
import { listSearch } from "@/modules/api";
import { Metadata } from "next";

export const generateMetadata = safeMetadata(async function generateMetadata({
  params: { id },
}: {
  params: { id: string };
}): Promise<Metadata> {
  id = decodeURIComponent(id);

  let search = await listSearch(id);

  return { title: search.name };
});

export default safePage(async function Search({
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
});
