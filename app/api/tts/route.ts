import { randomUUID } from "node:crypto";

import { synthesizeSpeech as synthesizeOpenAITts } from "@/lib/ai/openai-tts";
import { uploadTtsAudioAndCreateSignedUrl } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as {
      text?: unknown;
    };

    if (typeof body.text !== "string") {
      return Response.json({ error: "text is required" }, { status: 400 });
    }

    const text = body.text.trim();
    if (!text || text.length > 1000) {
      return Response.json({ error: "text must be 1-1000 characters" }, { status: 400 });
    }

    const mp3Buffer = await synthesizeOpenAITts({
      text,
      voice: "nova",
      speed: 0.85,
      timeoutMs: 8000,
    });

    const audioUrl = await uploadTtsAudioAndCreateSignedUrl({
      buffer: mp3Buffer,
      storagePath: `tts/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.mp3`,
    });

    return Response.json({ audio_url: audioUrl, engine: "openai" });
  } catch (error) {
    console.error("POST /api/tts error:", error);
    return Response.json({ error: "TTS failed" }, { status: 502 });
  } finally {
    console.log(`[tts] took ${Date.now() - startedAt}ms via openai`);
  }
}
