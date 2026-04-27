import { FamilyDashboardClient } from "./FamilyDashboardClient";

interface FamilyDashboardPageProps {
  params: Promise<{
    elderId: string;
  }>;
}

export default async function FamilyDashboardPage({
  params,
}: FamilyDashboardPageProps) {
  const { elderId } = await params;

  return <FamilyDashboardClient elderId={elderId} />;
}
