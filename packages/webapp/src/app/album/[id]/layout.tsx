import MediaGallery from "@/components/MediaGallery";

export default async function AlbumLayout({
  children,
  params: { id },
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <MediaGallery type={"album"} id={decodeURIComponent(id)}>
      {children}
    </MediaGallery>
  );
}
