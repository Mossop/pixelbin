import { useRouteLoaderData } from "@remix-run/react";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { SavedSearch } from "@/modules/types";

export default function SearchGallery() {
  let search = useRouteLoaderData("routes/search/layout") as SavedSearch;

  return (
    <SidebarLayout selectedItem={search.id}>
      <MediaGrid />
    </SidebarLayout>
  );
}
