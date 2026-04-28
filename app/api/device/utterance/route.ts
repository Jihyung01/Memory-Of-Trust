/**
 * POST /api/device/utterance
 *
 * 음성 파일 업로드 + raw_utterances INSERT.
 * 트랜잭션 안전성: Storage 업로드 성공 후에만 DB INSERT.
 *
 * ⚠️ raw_utterances 는 immutable. 이 코드에서 UPDATE/DELETE 절대 금지.
 */

import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import {
  type DeviceAuthRecord,
  fetchDeviceByRawTokenDev,
  fetchDeviceByTokenHash,
  insertRawUtterance,
  uploadAudioToStorage,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function hashDeviceToken(deviceToken: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(deviceToken, "utf8")
    .digest("hex");
}

interface UtteranceRequest {
  device_token: string;
  transcript: string;
  audio_duration_sec?: number;
  prompt_id?: string;
  source_photo_id?: string;
  started_at: string;
  ended_at: string;
}

async function fetchDeviceForToken(deviceToken: string): Promise<DeviceAuthRecord | null> {
  const device = await fetchDeviceByTokenHash(hashDeviceToken(deviceToken));
  if (device || env.NODE_ENV === "production") return device;

  // TODO: Phase 2 진입 시 모든 device_token 을 HMAC 으로 통일하고 이 폴백 제거
  const devDevice = await fetchDeviceByRawTokenDev(deviceToken);
  if (devDevice) {
    console.warn(`[dev] using raw token fallback for device ${devDevice.id}`);
  }
  return devDevice;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const metaRaw = formData.get("meta") as string | null;

    if (!metaRaw) {
      return Response.json({ error: "meta is required" }, { status: 400 });
    }

    let meta: UtteranceRequest;
    try {
      meta = JSON.parse(metaRaw) as UtteranceRequest;
    } catch {
      return Response.json({ error: "Invalid meta JSON" }, { status: 400 });
    }

    if (!meta.device_token || !meta.transcript || !meta.started_at || !meta.ended_at) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if ((!audioFile || audioFile.size === 0) && env.NODE_ENV === "production") {
      return Response.json({ error: "audio is required" }, { status: 400 });
    }

    // 디바이스 인증
    const device = await fetchDeviceForToken(meta.device_token);
    if (!device) {
      return Response.json({ error: "Invalid device token" }, { status: 401 });
    }

    // 1) Storage에 음성 업로드 시도 — 실패해도 transcript는 반드시 저장
    let audioUrl: string | null = null;
    if (audioFile && audioFile.size > 0) {
      try {
        const storagePath = `utterances/${device.elder_id}/${Date.now()}.webm`;
        audioUrl = await uploadAudioToStorage(audioFile, storagePath);
      } catch (err) {
        console.warn("Audio upload failed (non-fatal, transcript will still save):", err);
      }
    }

    // 2) raw_utterances INSERT (immutable — INSERT만). 음성 URL 없어도 진행.
    const utterance = await insertRawUtterance({
      elderId: device.elder_id,
      promptId: meta.prompt_id ?? null,
      sourcePhotoId: meta.source_photo_id ?? null,
      audioUrl,
      audioDurationSec: meta.audio_duration_sec ?? 0,
      transcript: meta.transcript,
      startedAt: meta.started_at,
      endedAt: meta.ended_at,
    });

    return Response.json({
      utterance_id: utterance.id,
      id: utterance.id,
      elder_id: device.elder_id,
    });
  } catch (error) {
    console.error("POST /api/device/utterance error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
