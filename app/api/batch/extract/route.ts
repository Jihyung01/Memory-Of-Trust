/**
 * POST /api/batch/extract
 *
 * raw_utterances → 8축 데이터 자동 추출 배치 API.
 * extraction_log로 처리 상태 추적, claim 패턴으로 race 방지.
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 */

import { generateTextGemini } from "@/lib/ai/gemini";
import { extractAxesPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  claimPendingExtractions,
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

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2분 타임아웃 (Vercel Pro)

interface ExtractedAxes {
  timeline_events?: Array<{
    title: string;
    approximate_year?: number | null;
    approximate_age?: number | null;
    description?: string | null;
  }>;
  entities?: Array<{
    name: string;
    relation?: string | null;
    emotional_tone?: string | null;
  }>;
  themes?: Array<{
    theme: string;
    weight?: number;
  }>;
  emotion?: {
    emotion: string;
    intensity: number;
  };
  unresolved?: Array<{
    type: string;
    toward_entity_name?: string | null;
    excerpt: string;
  }>;
  sensory?: Array<{
    sense: string;
    detail: string;
    context?: string | null;
  }>;
  memory_candidates?: Array<{
    fact: string;
    confidence: number;
    needs_family_check: boolean;
  }>;
}

function parseAxesJson(text: string): ExtractedAxes | null {
  // LLM이 markdown 코드블록으로 감쌀 수 있으므로 추출
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

  try {
    return JSON.parse(jsonStr) as ExtractedAxes;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // 인증
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    elder_id?: string;
    limit?: number;
  };

  const limit = Math.min(body.limit ?? 5, 20); // 최대 20개
  const errors: string[] = [];
  let succeeded = 0;
  let failed = 0;

  try {
    // 1. Claim pending extractions
    const claimed = await claimPendingExtractions(body.elder_id ?? null, limit);

    if (claimed.length === 0) {
      return Response.json({ claimed: 0, succeeded: 0, failed: 0, errors: [] });
    }

    // 2. 각 발화에 대해 추출 (Gemini Flash 무료 티어)
    for (const claim of claimed) {
      try {
        // transcript 조회
        const utterance = await fetchUtteranceTranscript(claim.utterance_id);
        if (!utterance) {
          await markExtractionFailed(claim.id, "Utterance not found");
          failed++;
          errors.push(`${claim.utterance_id}: utterance not found`);
          continue;
        }

        // Gemini LLM 호출
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
          await markExtractionFailed(claim.id, "Invalid JSON response from LLM");
          failed++;
          errors.push(`${claim.utterance_id}: JSON parse failed`);
          continue;
        }

        // 3. 8축 INSERT (개별 실패해도 나머지 진행)
        const elderId = claim.elder_id;
        const uttId = claim.utterance_id;

        // timeline_events
        for (const event of axes.timeline_events ?? []) {
          try {
            await insertTimelineEvent({
              elderId,
              utteranceId: uttId,
              title: event.title,
              approximateYear: event.approximate_year,
              approximateAge: event.approximate_age,
              description: event.description,
            });
          } catch (e) {
            errors.push(`${uttId}/timeline: ${String(e)}`);
          }
        }

        // entities
        for (const entity of axes.entities ?? []) {
          try {
            await upsertEntity({
              elderId,
              utteranceId: uttId,
              name: entity.name,
              relation: entity.relation,
              emotionalTone: entity.emotional_tone,
            });
          } catch (e) {
            errors.push(`${uttId}/entity: ${String(e)}`);
          }
        }

        // themes
        for (const theme of axes.themes ?? []) {
          try {
            await insertTheme({
              elderId,
              utteranceId: uttId,
              theme: theme.theme,
              weight: theme.weight,
            });
          } catch (e) {
            errors.push(`${uttId}/theme: ${String(e)}`);
          }
        }

        // emotion
        if (axes.emotion) {
          try {
            await insertEmotionLayer({
              elderId,
              utteranceId: uttId,
              emotion: axes.emotion.emotion,
              intensity: axes.emotion.intensity,
            });
          } catch (e) {
            errors.push(`${uttId}/emotion: ${String(e)}`);
          }
        }

        // unresolved
        for (const item of axes.unresolved ?? []) {
          try {
            await insertUnresolvedItem({
              elderId,
              utteranceId: uttId,
              type: item.type,
              excerpt: item.excerpt,
            });
          } catch (e) {
            errors.push(`${uttId}/unresolved: ${String(e)}`);
          }
        }

        // sensory
        for (const detail of axes.sensory ?? []) {
          try {
            await insertSensoryDetail({
              elderId,
              utteranceId: uttId,
              sense: detail.sense,
              detail: detail.detail,
              context: detail.context,
            });
          } catch (e) {
            errors.push(`${uttId}/sensory: ${String(e)}`);
          }
        }

        // memory_candidates
        for (const candidate of axes.memory_candidates ?? []) {
          try {
            await insertMemoryCandidate({
              elderId,
              utteranceId: uttId,
              fact: candidate.fact,
              confidence: candidate.confidence,
              needsFamilyCheck: candidate.needs_family_check,
            });
          } catch (e) {
            errors.push(`${uttId}/memory: ${String(e)}`);
          }
        }

        // 4. 성공 마킹
        await markExtractionDone(claim.id);
        succeeded++;
      } catch (e) {
        // 전체 발화 처리 실패
        try {
          await markExtractionFailed(claim.id, String(e));
        } catch {
          // 마킹도 실패하면 로그만
        }
        failed++;
        errors.push(`${claim.utterance_id}: ${String(e)}`);
      }
    }

    return Response.json({
      claimed: claimed.length,
      succeeded,
      failed,
      errors: errors.slice(0, 20), // 에러 최대 20개만
    });
  } catch (error) {
    console.error("POST /api/batch/extract error:", error);
    return Response.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
