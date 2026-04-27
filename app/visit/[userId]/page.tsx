import { VisitPageClient } from './visit-client';

export default async function VisitPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <VisitPageClient userId={userId} />;
}
