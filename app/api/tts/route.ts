/**
 * POST /api/tts
 *
 * 텍스트 → OpenAI TTS → mp3 바이너리 응답.
 * 디바이스에서 <audio> 자동 재생용.
 */

import { createHmac } from "node:crypto";

import { synthesizeSpeech } from "@/lib/ai/openai-tts";
import { env } from "@/lib/env";
import { fetchDeviceByTokenHash } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function hashDeviceToken(deviceToken: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(deviceToken, "utf8")
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      device_token?: string;
      text?: string;
    };

    if (!body.device_token || !body.text) {
      return Response.json({ error: "device_token and text required" }, { status: 400 });
    }

    // 디바이스 인증
    const device = await fetchDeviceByTokenHash(hashDeviceToken(body.device_token));
    if (!device) {
      return Response.json({ error: "Invalid device token" }, { status: 401 });
    }

    const mp3Buffer = await synthesizeSpeech({
      text: body.text,
      speed: 0.85, // 어르신용 약간 느리게 (OpenAI: 0.25~4.0)
    });

    return new Response(new Uint8Array(mp3Buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(mp3Buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("POST /api/tts error:", error);
    return Response.json({ error: "TTS failed" }, { status: 502 });
  }
}
