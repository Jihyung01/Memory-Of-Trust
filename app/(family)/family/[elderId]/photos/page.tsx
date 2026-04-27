import { PhotosPageClient } from "./PhotosPageClient";

interface PhotosPageProps {
  params: Promise<{
    elderId: string;
  }>;
}

export default async function PhotosPage({ params }: PhotosPageProps) {
  const { elderId } = await params;

  return <PhotosPageClient elderId={elderId} />;
}
