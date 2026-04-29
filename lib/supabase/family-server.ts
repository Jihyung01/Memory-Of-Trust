import {
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import type {
  FamilyUtteranceRecord,
  StoryOutputRecord,
} from "@/lib/supabase/family";

export interface DevFamilyDashboardData {
  utterances: FamilyUtteranceRecord[];
  weeklyCards: StoryOutputRecord[];
  monthlyChapters: StoryOutputRecord[];
}

export async function fetchDevFamilyDashboardData(
  elderId: string
): Promise<DevFamilyDashboardData> {
  const db = getSupabaseServiceClient();

  const [utterancesResult, cardsResult, chaptersResult] = await Promise.all([
    db
      .from("raw_utterances")
      .select("id, transcript, started_at")
      .eq("elder_id", elderId)
      .order("started_at", { ascending: false })
      .limit(50),
    db
      .from("story_outputs")
      .select("id, output_type, title, content, created_at")
      .eq("elder_id", elderId)
      .eq("output_type", "weekly_card")
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("story_outputs")
      .select("id, output_type, title, content, created_at")
      .eq("elder_id", elderId)
      .eq("output_type", "monthly_chapter")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (utterancesResult.error) {
    throw new Error(
      `[supabase] Failed to fetch dev utterances: ${utterancesResult.error.message}`
    );
  }

  if (cardsResult.error) {
    throw new Error(`[supabase] Failed to fetch dev cards: ${cardsResult.error.message}`);
  }

  if (chaptersResult.error) {
    throw new Error(
      `[supabase] Failed to fetch dev chapters: ${chaptersResult.error.message}`
    );
  }

  return {
    utterances: (utterancesResult.data ?? []) as FamilyUtteranceRecord[],
    weeklyCards: (cardsResult.data ?? []) as StoryOutputRecord[],
    monthlyChapters: (chaptersResult.data ?? []) as StoryOutputRecord[],
  };
}
