/**
 * POST /api/batch/monthly-chapter
 *
 * 8축 구조 데이터 기반 월간 챕터 생성 → story_outputs UPSERT.
 * 인증: Authorization: Bearer {CRON_SECRET}
 */

import { generateTextGemini } from "@/lib/ai/gemini";

import { monthlyChapterPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  fetchElderById,
  fetchMemoryCandidatesInRange,
  fetchThemesInRange,
  fetchTimelineEventsInRange,
  fetchTopEntities,
  fetchUtteranceIdsInRange,
  upsertStoryOutput,
} from "@/lib/supabase/server";
import {
  getLastMonthBoundsUtc,
  getMonthBoundsFromStrUtc,
} from "@/lib/time/kst";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    elder_id: string;
    month?: string; // "2026-04"
  };

  if (!body.elder_id) {
    return Response.json({ error: "elder_id required" }, { status: 400 });
  }

  try {
    const bounds = body.month
      ? getMonthBoundsFromStrUtc(body.month)
      : getLastMonthBoundsUtc();

    const { monthStart, monthEnd, monthLabel } = bounds;

    const [timelineEvents, themes, entitiesTop, memoryCandidates, utteranceIds, elder] =
      await Promise.all([
        fetchTimelineEventsInRange(body.elder_id, monthStart, monthEnd),
        fetchThemesInRange(body.elder_id, monthStart, monthEnd),
        fetchTopEntities(body.elder_id, 10),
        fetchMemoryCandidatesInRange(body.elder_id, monthStart, monthEnd),
        fetchUtteranceIdsInRange(body.elder_id, monthStart, monthEnd),
        fetchElderById(body.elder_id),
      ]);

    const displayName = elder?.display_name ?? elder?.name ?? "어르신";

    if (timelineEvents.length === 0 && themes.length === 0) {
      return Response.json({
        skipped: true,
        reason: "No data for this month",
        monthLabel,
      });
    }

    const prompt = monthlyChapterPrompt({
      elderDisplayName: displayName,
      monthLabel,
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
      return Response.json({ error: "Empty LLM response" }, { status: 500 });
    }

    const result = await upsertStoryOutput({
      elderId: body.elder_id,
      outputType: "monthly_chapter",
      title: monthLabel,
      content,
      sourceUtteranceIds: utteranceIds,
      generatedByModel: env.GEMINI_MODEL,
    });

    return Response.json({
      id: result.id,
      created: result.created,
      monthLabel,
      utterance_count: utteranceIds.length,
    });
  } catch (error) {
    console.error("POST /api/batch/monthly-chapter error:", error);
    return Response.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
