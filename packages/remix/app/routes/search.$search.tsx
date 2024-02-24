import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SidebarLayout from "@/components/SidebarLayout";
import { getSearch } from "@/modules/api";
import { getSession } from "@/modules/session";

export async function loader({
  request,
  params: { search: id },
}: LoaderFunctionArgs) {
  let session = await getSession(request);
  let search = await getSearch(session, id!);

  return json(search);
}

export const meta: MetaFunction<typeof loader> = ({ data: search }) => [
  { title: search?.name },
];

export default function SearchGallery() {
  let search = useLoaderData<typeof loader>();

  return (
    <MediaGallery type={"search"} id={search.id}>
      <SidebarLayout selectedItem={search.id}>
        <MediaGrid />
      </SidebarLayout>
    </MediaGallery>
  );
}
