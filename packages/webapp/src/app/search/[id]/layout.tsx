import MediaGallery from "@/components/MediaGallery";

export default async function SearchLayout({
  children,
  params: { id },
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <MediaGallery type={"search"} id={decodeURIComponent(id)}>
      {children}
    </MediaGallery>
  );
}
