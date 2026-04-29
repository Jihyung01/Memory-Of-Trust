/**
 * POST /api/stt
 *
 * 음성 Blob → Whisper STT → transcript 반환.
 * 디바이스 토큰 인증 필수.
 */

import { createHmac } from "node:crypto";

import { transcribeWithGroq } from "@/lib/ai/groq-stt";
import { env } from "@/lib/env";
import { fetchDeviceByTokenHash } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 한국어 STT 환각(hallucination) 패턴 필터
const HALLUCINATION_PATTERNS = [
  /^(MBC|SBS|KBS|YTN)/,
  /시청해\s*주셔서\s*감사합니다/,
  /구독과\s*좋아요/,
  /^(네|예|아|음|어){1,3}$/,
  /^\.+$/,
  /자막|번역|제공/,
];

function isHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return HALLUCINATION_PATTERNS.some((p) => p.test(trimmed));
}

function hashDeviceToken(deviceToken: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(deviceToken, "utf8")
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const deviceToken = formData.get("device_token") as string | null;

    if (!deviceToken || deviceToken.length > 512) {
      return Response.json({ error: "device_token is required" }, { status: 400 });
    }

    if (!audioFile || audioFile.size === 0) {
      return Response.json({ error: "audio file is required" }, { status: 400 });
    }

    // 디바이스 인증
    const device = await fetchDeviceByTokenHash(hashDeviceToken(deviceToken));
    if (!device) {
      return Response.json({ error: "Invalid device token" }, { status: 401 });
    }

    // Groq Whisper STT (무료)
    let transcript: string;
    let duration: number | undefined;
    try {
      const result = await transcribeWithGroq(audioFile, "ko");
      transcript = result.text;
      duration = result.duration;
    } catch (err) {
      console.error("[stt] Groq Whisper error:", err);
      return Response.json({ error: "STT failed" }, { status: 502 });
    }

    // 환각 필터
    if (!transcript || isHallucination(transcript)) {
      return Response.json({
        transcript: "",
        filtered: true,
        elder_id: device.elder_id,
      });
    }

    return Response.json({
      transcript,
      filtered: false,
      duration: duration ?? null,
      elder_id: device.elder_id,
    });
  } catch (error) {
    console.error("POST /api/stt error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
