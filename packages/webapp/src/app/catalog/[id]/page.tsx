import SidebarLayout from "@/components/SidebarLayout";

export default function Catalog({
  params: { id },
}: {
  params: { id: string };
}) {
  return (
    <SidebarLayout selectedItem={decodeURIComponent(id)}>Catalog</SidebarLayout>
  );
}
