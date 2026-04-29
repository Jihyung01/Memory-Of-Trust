/**
 * Groq Whisper STT — 무료 티어
 *
 * OpenAI Whisper 대체. 동일한 whisper-large-v3 모델.
 * 하루 2,000건, 시간당 7,200초 제한.
 *
 * API: https://api.groq.com/openai/v1/audio/transcriptions
 */

import { env } from "@/lib/env";

export interface GroqSTTResult {
  text: string;
  duration?: number;
}

export async function transcribeWithGroq(
  audioFile: File,
  language: string = "ko"
): Promise<GroqSTTResult> {
  const formData = new FormData();
  formData.append("file", audioFile, "recording.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("language", language);
  formData.append("response_format", "verbose_json");

  const response = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown");
    console.error("[groq-stt] API error:", response.status, errorText);
    throw new Error(`[groq-stt] STT failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    text: string;
    duration?: number;
  };

  return {
    text: (result.text ?? "").trim(),
    duration: result.duration,
  };
}
