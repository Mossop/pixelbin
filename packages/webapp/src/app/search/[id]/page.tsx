import SidebarLayout from "@/components/SidebarLayout";

export default function Search({ params: { id } }: { params: { id: string } }) {
  return (
    <SidebarLayout selectedItem={decodeURIComponent(id)}>Search</SidebarLayout>
  );
}
