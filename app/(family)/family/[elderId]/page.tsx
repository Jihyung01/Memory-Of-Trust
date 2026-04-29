import { FamilyDashboardClient } from "./FamilyDashboardClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { fetchDevFamilyDashboardData } from "@/lib/supabase/family-server";

interface FamilyDashboardPageProps {
  params: Promise<{
    elderId: string;
  }>;
}

export default async function FamilyDashboardPage({
  params,
}: FamilyDashboardPageProps) {
  const { elderId } = await params;
  const cookieStore = await cookies();
  const devElderId = cookieStore.get("dev_elder_id")?.value;
  const isDevBypassEnabled =
    env.NODE_ENV !== "production" &&
    env.ENABLE_DEV_PAGE === "true" &&
    devElderId === elderId;

  if (env.NODE_ENV !== "production" && env.ENABLE_DEV_PAGE === "true" && !devElderId) {
    redirect("/dev");
  }

  if (isDevBypassEnabled) {
    const initialData = await fetchDevFamilyDashboardData(elderId);

    return (
      <FamilyDashboardClient
        devBypass
        elderId={elderId}
        initialMonthlyChapters={initialData.monthlyChapters}
        initialUtterances={initialData.utterances}
        initialWeeklyCards={initialData.weeklyCards}
      />
    );
  }

  return <FamilyDashboardClient elderId={elderId} />;
}
