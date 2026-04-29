/**
 * GET /api/cron/monthly-chapter
 *
 * Vercel Cron wrapper: 모든 active elders에 대해 월간 챕터 생성.
 * Schedule: 매월 1일 KST 11:00 (UTC 02:00)
 */

import { generateTextGemini } from "@/lib/ai/gemini";
import { monthlyChapterPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  fetchActiveElders,
  fetchElderById,
  fetchMemoryCandidatesInRange,
  fetchThemesInRange,
  fetchTimelineEventsInRange,
  fetchTopEntities,
  fetchUtteranceIdsInRange,
  upsertStoryOutput,
} from "@/lib/supabase/server";
import { getLastMonthBoundsUtc } from "@/lib/time/kst";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const elders = await fetchActiveElders();
    const bounds = getLastMonthBoundsUtc();
    const results = [];

    for (const elder of elders) {
      try {
        const [timelineEvents, themes, entitiesTop, memoryCandidates, utteranceIds, elderDetail] =
          await Promise.all([
            fetchTimelineEventsInRange(elder.id, bounds.monthStart, bounds.monthEnd),
            fetchThemesInRange(elder.id, bounds.monthStart, bounds.monthEnd),
            fetchTopEntities(elder.id, 10),
            fetchMemoryCandidatesInRange(elder.id, bounds.monthStart, bounds.monthEnd),
            fetchUtteranceIdsInRange(elder.id, bounds.monthStart, bounds.monthEnd),
            fetchElderById(elder.id),
          ]);

        if (timelineEvents.length === 0 && themes.length === 0) {
          results.push({ elder_id: elder.id, ok: true, skipped: true });
          continue;
        }

        const displayName = elderDetail?.display_name ?? elderDetail?.name ?? "어르신";

        const prompt = monthlyChapterPrompt({
          elderDisplayName: displayName,
          monthLabel: bounds.monthLabel,
          timelineEvents,
          themes,
          entitiesTop,
          memoryCandidates,
        });

        const content = await generateTextGemini({
          systemPrompt: "You are a warm Korean autobiographer writing memory chapters for elderly people.",
          prompt,
          temperature: 0.7,
          maxTokens: 4000,
          timeoutMs: 60_000,
        });
        if (!content) {
          results.push({ elder_id: elder.id, ok: false, error: "Empty LLM response" });
          continue;
        }

        const result = await upsertStoryOutput({
          elderId: elder.id,
          outputType: "monthly_chapter",
          title: bounds.monthLabel,
          content,
          sourceUtteranceIds: utteranceIds,
          generatedByModel: env.GEMINI_MODEL,
        });

        results.push({ elder_id: elder.id, ok: true, id: result.id, created: result.created });
      } catch (e) {
        results.push({ elder_id: elder.id, ok: false, error: String(e) });
      }
    }

    return Response.json({ monthLabel: bounds.monthLabel, results });
  } catch (error) {
    console.error("GET /api/cron/monthly-chapter error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
