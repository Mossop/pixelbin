import { useRouteLoaderData } from "@remix-run/react";

import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { Catalog } from "@/modules/types";

export default function CatalogGallery() {
  let catalog = useRouteLoaderData("routes/catalog/layout") as Catalog;

  return (
    <SidebarLayout selectedItem={catalog.id}>
      <MediaGrid />
    </SidebarLayout>
  );
}
