/**
 * GET /api/cron/extract
 *
 * Vercel Cron wrapper: 모든 active elders에 대해 추출 파이프라인 실행.
 * Schedule: 2시간마다
 */

import { env } from "@/lib/env";
import {
  claimPendingExtractions,
  fetchActiveElders,
  fetchUtteranceTranscript,
  insertEmotionLayer,
  insertMemoryCandidate,
  insertSensoryDetail,
  insertTheme,
  insertTimelineEvent,
  insertUnresolvedItem,
  markExtractionDone,
  markExtractionFailed,
  upsertEntity,
} from "@/lib/supabase/server";
import { generateTextGemini } from "@/lib/ai/gemini";
import { extractAxesPrompt } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5분

interface ExtractedAxes {
  timeline_events?: Array<{ title: string; approximate_year?: number | null; approximate_age?: number | null; description?: string | null }>;
  entities?: Array<{ name: string; relation?: string | null; emotional_tone?: string | null }>;
  themes?: Array<{ theme: string; weight?: number }>;
  emotion?: { emotion: string; intensity: number };
  unresolved?: Array<{ type: string; toward_entity_name?: string | null; excerpt: string }>;
  sensory?: Array<{ sense: string; detail: string; context?: string | null }>;
  memory_candidates?: Array<{ fact: string; confidence: number; needs_family_check: boolean }>;
}

function parseAxesJson(text: string): ExtractedAxes | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr) as ExtractedAxes;
  } catch {
    return null;
  }
}

async function processOneElder(
  elderId: string
): Promise<{ claimed: number; succeeded: number; failed: number }> {
  const claimed = await claimPendingExtractions(elderId, 10);
  let succeeded = 0;
  let failed = 0;

  for (const claim of claimed) {
    try {
      const utterance = await fetchUtteranceTranscript(claim.utterance_id);
      if (!utterance) {
        await markExtractionFailed(claim.id, "Utterance not found");
        failed++;
        continue;
      }

      const prompt = extractAxesPrompt({ transcript: utterance.transcript });
      const responseText = await generateTextGemini({
        systemPrompt: "You are a Korean language data extraction assistant. Always respond in valid JSON.",
        prompt,
        temperature: 0.3,
        maxTokens: 2000,
        timeoutMs: 30_000,
      });

      const axes = parseAxesJson(responseText);
      if (!axes) {
        await markExtractionFailed(claim.id, "JSON parse failed");
        failed++;
        continue;
      }

      // 8축 INSERT
      for (const e of axes.timeline_events ?? []) {
        try { await insertTimelineEvent({ elderId, utteranceId: claim.utterance_id, title: e.title, approximateYear: e.approximate_year, approximateAge: e.approximate_age, description: e.description }); } catch {}
      }
      for (const e of axes.entities ?? []) {
        try { await upsertEntity({ elderId, utteranceId: claim.utterance_id, name: e.name, relation: e.relation, emotionalTone: e.emotional_tone }); } catch {}
      }
      for (const t of axes.themes ?? []) {
        try { await insertTheme({ elderId, utteranceId: claim.utterance_id, theme: t.theme, weight: t.weight }); } catch {}
      }
      if (axes.emotion) {
        try { await insertEmotionLayer({ elderId, utteranceId: claim.utterance_id, emotion: axes.emotion.emotion, intensity: axes.emotion.intensity }); } catch {}
      }
      for (const u of axes.unresolved ?? []) {
        try { await insertUnresolvedItem({ elderId, utteranceId: claim.utterance_id, type: u.type, excerpt: u.excerpt }); } catch {}
      }
      for (const s of axes.sensory ?? []) {
        try { await insertSensoryDetail({ elderId, utteranceId: claim.utterance_id, sense: s.sense, detail: s.detail, context: s.context }); } catch {}
      }
      for (const m of axes.memory_candidates ?? []) {
        try { await insertMemoryCandidate({ elderId, utteranceId: claim.utterance_id, fact: m.fact, confidence: m.confidence, needsFamilyCheck: m.needs_family_check }); } catch {}
      }

      await markExtractionDone(claim.id);
      succeeded++;
    } catch (e) {
      try { await markExtractionFailed(claim.id, String(e)); } catch {}
      failed++;
    }
  }

  return { claimed: claimed.length, succeeded, failed };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const elders = await fetchActiveElders();
    const results = [];

    for (const elder of elders) {
      try {
        const r = await processOneElder(elder.id);
        results.push({ elder_id: elder.id, ok: true, ...r });
      } catch (e) {
        results.push({ elder_id: elder.id, ok: false, error: String(e) });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error("GET /api/cron/extract error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
