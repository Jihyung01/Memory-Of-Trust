/**
 * OpenAI TTS (Text-to-Speech)
 *
 * Clova Voice 대신 OpenAI tts-1 사용.
 * 한국어 자동 감지, 어르신에게 따뜻한 음성으로 응답.
 *
 * 비용: $15/1M chars → 어르신 1명 기준 월 ~$0.45
 */

import { env } from "@/lib/env";

export interface TTSOptions {
  text: string;
  /**
   * OpenAI TTS voice.
   * "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
   * nova: 따뜻하고 부드러운 여성 음성 — 어르신 대상 적합
   */
  voice?: string;
  /** 0.25 ~ 4.0, 기본 1.0. 어르신용은 약간 느리게 0.85 */
  speed?: number;
}

/**
 * OpenAI TTS 호출 → mp3 Buffer 반환
 */
export async function synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
  const { text, voice = "nova", speed = 0.85 } = options;

  if (!text || text.trim().length === 0) {
    throw new Error("[openai-tts] Empty text for TTS");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4096), // OpenAI TTS 글자 제한
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    throw new Error(
      `[openai-tts] TTS failed: ${response.status} — ${errorText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
