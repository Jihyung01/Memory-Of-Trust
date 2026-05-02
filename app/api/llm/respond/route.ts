import { generateTextGemini } from "@/lib/ai/gemini";
import { ELDER_CHARACTER_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { fetchRawUtteranceForResponse } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RespondRequest {
  utterance_id?: unknown;
  transcript?: unknown;
  elder_id?: unknown;
  turn_count?: unknown;
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
  "인공지능",
  "챗봇",
  "언어 모델",
  "프로그램",
];

/** "AI"는 독립 단어일 때만 차단 (e.g. "AI입니다") — "사이", "내", "아이" 등 오탐 방지 */
const FORBIDDEN_RESPONSE_PATTERNS = [
  /\bAI\b/i,
];

const SAFE_FALLBACK_RESPONSE = "그러셨어요...";
const END_TAG_PATTERN = /\s*\[END\]\s*$/i;

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeResponse(responseText: string): string {
  const matchedTerm = FORBIDDEN_RESPONSE_TERMS.find((term) => responseText.includes(term));
  if (matchedTerm) {
    console.warn(`[llm/respond] forbidden term fallback applied: ${matchedTerm}`);
    return SAFE_FALLBACK_RESPONSE;
  }

  const matchedPattern = FORBIDDEN_RESPONSE_PATTERNS.find((re) => re.test(responseText));
  if (matchedPattern) {
    console.warn(`[llm/respond] forbidden pattern fallback applied: ${matchedPattern}`);
    return SAFE_FALLBACK_RESPONSE;
  }

  return responseText;
}

function readTurnCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as RespondRequest;
    const utteranceId = readString(body.utterance_id);
    let transcript = readString(body.transcript);
    let elderId = readString(body.elder_id);
    const turnCount = readTurnCount(body.turn_count);

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

    const responseText = await generateTextGemini({
      model: "gemma-3-4b-it", // 대화용: 빠른 응답 우선
      systemPrompt: [
        ELDER_CHARACTER_SYSTEM_PROMPT,
        "",
        "【대화 종료 규칙】",
        "- 대화를 자연스럽게 마무리할 때만 응답 끝에 [END] 를 붙인다.",
        "- 어르신이 이야기를 이어가려는 흐름이면 [END]를 절대 붙이지 않는다.",
        "- [END]는 시스템 신호다. 말풍선에 보이지 않으니 설명하지 않는다.",
        turnCount >= 10
          ? "- 이번 턴에서 부드럽게 마무리하고 [END]를 붙인다."
          : "- 아직 대화 초반이니 [END]를 붙이지 않는다. 어르신이 더 말씀하시게 유도한다.",
        "",
        "【추가 주의】",
        "- 자기 소개를 하지 않는다. 이미 대화 중이다.",
        "- 어르신 말씀을 되묻거나 감탄하며 받아준다.",
        "- 감각적 질문으로 이야기를 넓힌다 (냄새, 소리, 풍경 등).",
        "- 절대 '도와드릴까요', '무엇을 해드릴까요' 같은 서비스 어투를 쓰지 않는다.",
      ]
        .join("\n"),
      prompt: [
        `어르신이 방금 하신 말씀: "${transcript}"`,
        "",
        "위 말에 이어서 손주 같은 작가로서 1~2문장만 자연스럽게 답하세요.",
        "어르신이 더 말하고 싶게 만드는 짧은 반응이면 됩니다.",
      ]
        .join("\n"),
      timeoutMs: 60_000,
    });
    const shouldEnd = END_TAG_PATTERN.test(responseText);
    const visibleResponseText = responseText.replace(END_TAG_PATTERN, "").trim();
    const sanitizedResponseText = sanitizeResponse(visibleResponseText);

    return Response.json({
      response_text: sanitizedResponseText,
      should_end: shouldEnd && sanitizedResponseText === visibleResponseText,
    });
  } catch (error) {
    console.error("POST /api/llm/respond error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: "LLM response failed", details: msg }, { status: 502 });
  } finally {
    console.log(`[llm/respond] took ${Date.now() - startedAt}ms`);
  }
}
