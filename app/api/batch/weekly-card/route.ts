/**
 * POST /api/batch/weekly-card
 *
 * 8축 구조 데이터 기반 주간 카드 생성 → story_outputs UPSERT.
 * 인증: Authorization: Bearer {CRON_SECRET}
 */

import { generateTextGemini } from "@/lib/ai/gemini";

import { weeklyCardPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  fetchElderById,
  fetchOpenUnresolved,
  fetchSensoryDetailsInRange,
  fetchThemesInRange,
  fetchTimelineEventsInRange,
  fetchTopEntities,
  fetchUtteranceIdsInRange,
  upsertStoryOutput,
} from "@/lib/supabase/server";
import {
  getLastWeekBoundsUtc,
  getWeekBoundsFromDateUtc,
} from "@/lib/time/kst";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    elder_id: string;
    week_start?: string; // KST ISO date "2026-04-21"
  };

  if (!body.elder_id) {
    return Response.json({ error: "elder_id required" }, { status: 400 });
  }

  try {
    // 주 경계 계산
    const bounds = body.week_start
      ? getWeekBoundsFromDateUtc(body.week_start)
      : getLastWeekBoundsUtc();

    const { weekStart, weekEnd, weekLabel } = bounds;

    // 8축 데이터 조회
    const [timelineEvents, themes, sensoryDetails, unresolvedOpen, entitiesTop, utteranceIds, elder] =
      await Promise.all([
        fetchTimelineEventsInRange(body.elder_id, weekStart, weekEnd),
        fetchThemesInRange(body.elder_id, weekStart, weekEnd),
        fetchSensoryDetailsInRange(body.elder_id, weekStart, weekEnd),
        fetchOpenUnresolved(body.elder_id),
        fetchTopEntities(body.elder_id, 10),
        fetchUtteranceIdsInRange(body.elder_id, weekStart, weekEnd),
        fetchElderById(body.elder_id),
      ]);

    const displayName = elder?.display_name ?? elder?.name ?? "어르신";

    // 데이터 없으면 스킵
    if (timelineEvents.length === 0 && themes.length === 0) {
      return Response.json({
        skipped: true,
        reason: "No data for this week",
        weekLabel,
      });
    }

    // 프롬프트 생성 + LLM 호출
    const prompt = weeklyCardPrompt({
      elderDisplayName: displayName,
      weekLabel,
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
      return Response.json({ error: "Empty LLM response" }, { status: 500 });
    }

    // story_outputs UPSERT
    const result = await upsertStoryOutput({
      elderId: body.elder_id,
      outputType: "weekly_card",
      title: weekLabel,
      content,
      sourceUtteranceIds: utteranceIds,
      generatedByModel: env.GEMINI_MODEL,
    });

    return Response.json({
      id: result.id,
      created: result.created,
      weekLabel,
      utterance_count: utteranceIds.length,
    });
  } catch (error) {
    console.error("POST /api/batch/weekly-card error:", error);
    return Response.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
