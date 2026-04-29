/**
 * Google Gemini LLM — 무료 티어
 *
 * GPT-4o-mini(대화) + GPT-4o(추출) 대체.
 * 하루 1,000건, 분당 15건 제한.
 * 한국어 성능 GPT-4o-mini급 이상.
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

export async function generateTextGemini(
  input: string | GeminiGenerateOptions
): Promise<string> {
  const options = typeof input === "string" ? { prompt: input } : input;
  const model = options.model ?? env.GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? 15_000;
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    console.error(`[gemini] API error: ${response.status}`, errorText);
    throw new Error(`[gemini] API error: ${response.status}`);
  }

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
