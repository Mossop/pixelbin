import SidebarLayout from "@/components/SidebarLayout";

export default function Album({ params: { id } }: { params: { id: string } }) {
  return (
    <SidebarLayout selectedItem={decodeURIComponent(id)}>Album</SidebarLayout>
  );
}
