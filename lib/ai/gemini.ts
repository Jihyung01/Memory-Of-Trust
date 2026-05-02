/**
 * Google Generative Language API — 무료 티어
 *
 * 기본 모델: Gemma 4 27B (오픈소스, 무료 한도 넉넉)
 * - RPM 15, TPM 무제한, RPD 1,500
 *
 * 429 에러 시 자동 재시도 (최대 2회, API가 알려준 retryDelay 존중).
 * 일일 한도 초과 시에는 재시도해도 실패 — 리셋 기다려야 함.
 *
 * API: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */

import { env } from "@/lib/env";

export interface GeminiGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  timeoutMs?: number;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const MAX_RETRIES = 2;

/**
 * 429 응답에서 retryDelay 파싱 (초 단위).
 * 예: "retryDelay": "29s" → 29
 */
function parseRetryDelaySec(errorBody: string): number | null {
  try {
    const parsed = JSON.parse(errorBody);
    const details = parsed?.error?.details;
    if (!Array.isArray(details)) return null;

    for (const d of details) {
      if (d?.retryDelay) {
        const match = String(d.retryDelay).match(/^([\d.]+)/);
        if (match) return Math.ceil(Number(match[1]));
      }
    }
  } catch {
    // parse 실패 무시
  }
  return null;
}

/**
 * 일일 한도(DayPerProject) 초과인지 판별.
 * 일일 한도는 재시도해도 소용없으므로 바로 실패.
 */
function isDailyQuotaExhausted(errorBody: string): boolean {
  return errorBody.includes("PerDayPerProject") && errorBody.includes('"limit": 0');
}

export async function generateTextGemini(
  input: string | GeminiGenerateOptions
): Promise<string> {
  const options = typeof input === "string" ? { prompt: input } : input;
  const model = options.model ?? env.GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxTokens = options.maxTokens ?? 256;
  const temperature = options.temperature ?? 0.5;

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (options.systemPrompt) {
    contents.push({
      role: "user",
      parts: [{ text: `[System]\n${options.systemPrompt}\n\n[User]\n${options.prompt}` }],
    });
  } else {
    contents.push({
      role: "user",
      parts: [{ text: options.prompt }],
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const requestBody = JSON.stringify({
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) {
        throw new Error("[gemini] Empty text response");
      }

      return text;
    }

    // 에러 처리
    const errorText = await response.text().catch(() => "unknown");

    if (response.status === 429) {
      // 일일 한도 초과 → 재시도 무의미
      if (isDailyQuotaExhausted(errorText)) {
        console.error(`[gemini] Daily quota exhausted (attempt ${attempt + 1})`);
        throw new Error("[gemini] Daily quota exhausted. Resets ~4PM KST.");
      }

      // 분당 한도 초과 → retryDelay만큼 대기 후 재시도
      if (attempt < MAX_RETRIES) {
        const delaySec = parseRetryDelaySec(errorText) ?? 10;
        // 최대 30초 대기 (Vercel 타임아웃 고려)
        const waitMs = Math.min(delaySec, 30) * 1000;
        console.warn(`[gemini] 429 rate limit, retrying in ${delaySec}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      console.error(`[gemini] 429 after ${MAX_RETRIES + 1} attempts`, errorText);
      lastError = new Error(`[gemini] Rate limited after ${MAX_RETRIES + 1} attempts`);
      break;
    }

    // 429 아닌 에러는 바로 throw
    console.error(`[gemini] API error: ${response.status}`, errorText);
    throw new Error(`[gemini] API error: ${response.status}`);
  }

  throw lastError ?? new Error("[gemini] Unknown error");
}
