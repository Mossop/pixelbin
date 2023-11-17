import MediaGallery from "@/components/MediaGallery";

export default async function CatalogLayout({
  children,
  params: { id },
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <MediaGallery type={"catalog"} id={decodeURIComponent(id)}>
      {children}
    </MediaGallery>
  );
}
