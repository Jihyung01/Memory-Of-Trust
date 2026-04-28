import { generateText } from "@/lib/ai/openai";
import { ELDER_CHARACTER_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { fetchRawUtteranceForResponse } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RespondRequest {
  utterance_id?: unknown;
  transcript?: unknown;
  elder_id?: unknown;
}

const FORBIDDEN_RESPONSE_TERMS = [
  "기록",
  "저장",
  "녹음",
  "수집",
  "도와드릴까요",
  "무엇을 도와드릴까요",
  "힘내세요",
  "긍정적으로",
  "AI",
  "인공지능",
  "챗봇",
];

const SAFE_FALLBACK_RESPONSE = "그러셨어요...";

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeResponse(responseText: string): string {
  const matched = FORBIDDEN_RESPONSE_TERMS.find((term) => responseText.includes(term));
  if (!matched) return responseText;

  console.warn(`[llm/respond] forbidden term fallback applied: ${matched}`);
  return SAFE_FALLBACK_RESPONSE;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as RespondRequest;
    const utteranceId = readString(body.utterance_id);
    let transcript = readString(body.transcript);
    let elderId = readString(body.elder_id);

    if (utteranceId) {
      const utterance = await fetchRawUtteranceForResponse(utteranceId);
      if (!utterance) {
        return Response.json({ error: "utterance not found" }, { status: 404 });
      }
      transcript = utterance.transcript;
      elderId = utterance.elder_id;
    }

    if (!transcript) {
      return Response.json({ error: "utterance_id or transcript is required" }, { status: 400 });
    }

    const responseText = await generateText({
      systemPrompt: ELDER_CHARACTER_SYSTEM_PROMPT,
      prompt: [
        "다음은 어르신이 방금 하신 말씀입니다.",
        elderId ? `elder_id: ${elderId}` : null,
        `발화: ${transcript}`,
        "위 말에 이어서 1~2문장만 조용히 답하세요.",
      ]
        .filter(Boolean)
        .join("\n"),
      timeoutMs: 15_000,
    });

    return Response.json({
      response_text: sanitizeResponse(responseText),
    });
  } catch (error) {
    console.error("POST /api/llm/respond error:", error);
    return Response.json({ error: "LLM response failed" }, { status: 502 });
  } finally {
    console.log(`[llm/respond] took ${Date.now() - startedAt}ms`);
  }
}
