/**
 * GET /api/cron/weekly-card
 *
 * Vercel Cron wrapper: 모든 active elders에 대해 주간 카드 생성.
 * Schedule: 매주 월요일 KST 10:00 (UTC 01:00)
 */

import { generateTextGemini } from "@/lib/ai/gemini";
import { weeklyCardPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  fetchActiveElders,
  fetchElderById,
  fetchOpenUnresolved,
  fetchSensoryDetailsInRange,
  fetchThemesInRange,
  fetchTimelineEventsInRange,
  fetchTopEntities,
  fetchUtteranceIdsInRange,
  upsertStoryOutput,
} from "@/lib/supabase/server";
import { getLastWeekBoundsUtc } from "@/lib/time/kst";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const elders = await fetchActiveElders();
    const bounds = getLastWeekBoundsUtc();
    const results = [];

    for (const elder of elders) {
      try {
        const [timelineEvents, themes, sensoryDetails, unresolvedOpen, entitiesTop, utteranceIds, elderDetail] =
          await Promise.all([
            fetchTimelineEventsInRange(elder.id, bounds.weekStart, bounds.weekEnd),
            fetchThemesInRange(elder.id, bounds.weekStart, bounds.weekEnd),
            fetchSensoryDetailsInRange(elder.id, bounds.weekStart, bounds.weekEnd),
            fetchOpenUnresolved(elder.id),
            fetchTopEntities(elder.id, 10),
            fetchUtteranceIdsInRange(elder.id, bounds.weekStart, bounds.weekEnd),
            fetchElderById(elder.id),
          ]);

        if (timelineEvents.length === 0 && themes.length === 0) {
          results.push({ elder_id: elder.id, ok: true, skipped: true });
          continue;
        }

        const displayName = elderDetail?.display_name ?? elderDetail?.name ?? "어르신";

        const prompt = weeklyCardPrompt({
          elderDisplayName: displayName,
          weekLabel: bounds.weekLabel,
          timelineEvents,
          themes,
          unresolvedOpen,
          sensoryDetails,
          entitiesTop,
        });

        const content = await generateTextGemini({
          systemPrompt: "You are a warm, empathetic Korean writer creating family memory cards.",
          prompt,
          temperature: 0.7,
          maxTokens: 2000,
          timeoutMs: 30_000,
        });
        if (!content) {
          results.push({ elder_id: elder.id, ok: false, error: "Empty LLM response" });
          continue;
        }

        const result = await upsertStoryOutput({
          elderId: elder.id,
          outputType: "weekly_card",
          title: bounds.weekLabel,
          content,
          sourceUtteranceIds: utteranceIds,
          generatedByModel: env.GEMINI_MODEL,
        });

        results.push({ elder_id: elder.id, ok: true, id: result.id, created: result.created });
      } catch (e) {
        results.push({ elder_id: elder.id, ok: false, error: String(e) });
      }
    }

    return Response.json({ weekLabel: bounds.weekLabel, results });
  } catch (error) {
    console.error("GET /api/cron/weekly-card error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
