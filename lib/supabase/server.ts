import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;
const PHOTO_BUCKET = "photos";

function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return serviceClient;
}

export interface DeviceAuthRecord {
  id: string;
  elder_id: string;
}

export interface ElderRecord {
  id: string;
  display_name: string | null;
  name: string;
}

export interface PhotoPromptRecord {
  id: string;
  elder_id: string;
  storage_path: string;
  caption: string | null;
  approximate_year: number | null;
  people_in_photo: string[] | null;
}

export interface PromptRecord {
  id: string;
}

export async function fetchDeviceByTokenHash(
  tokenHash: string
): Promise<DeviceAuthRecord | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("devices")
    .select("id, elder_id")
    .eq("device_token", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch device: ${error.message}`);
  }

  return data as DeviceAuthRecord | null;
}

export async function fetchDeviceByRawTokenDev(
  rawToken: string
): Promise<DeviceAuthRecord | null> {
  if (env.NODE_ENV === "production") {
    throw new Error("[supabase] Raw device token fallback is disabled in production");
  }

  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("devices")
    .select("id, elder_id")
    .eq("device_token", rawToken)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch dev device: ${error.message}`);
  }

  return data as DeviceAuthRecord | null;
}

export async function touchDeviceLastActive(deviceId: string): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("devices")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", deviceId);

  if (error) {
    throw new Error(`[supabase] Failed to update device activity: ${error.message}`);
  }
}

export async function fetchElderById(elderId: string): Promise<ElderRecord | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("elders")
    .select("id, display_name, name")
    .eq("id", elderId)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch elder: ${error.message}`);
  }

  return data as ElderRecord | null;
}

export async function fetchLeastShownActivePhoto(
  elderId: string
): Promise<PhotoPromptRecord | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("photos")
    .select("id, elder_id, storage_path, caption, approximate_year, people_in_photo")
    .eq("elder_id", elderId)
    .eq("active", true)
    .order("shown_count", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch photo: ${error.message}`);
  }

  return data as PhotoPromptRecord | null;
}

export async function createPhotoPrompt(input: {
  elderId: string;
  promptText: string;
  photoId: string | null;
}): Promise<PromptRecord> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("prompts")
    .insert({
      elder_id: input.elderId,
      prompt_type: "photo_trigger",
      prompt_text: input.promptText,
      source_photo_id: input.photoId,
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`[supabase] Failed to create prompt: ${error.message}`);
  }

  return data as PromptRecord;
}

export async function createPhotoSignedUrl(storagePath: string): Promise<string> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw new Error(`[supabase] Failed to sign photo URL: ${error.message}`);
  }

  return data.signedUrl;
}

async function ensurePhotoBucket(): Promise<void> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.storage.getBucket(PHOTO_BUCKET);

  if (!error && data) return;

  const { error: createError } = await db.storage.createBucket(PHOTO_BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`[supabase] Failed to ensure photo bucket: ${createError.message}`);
  }
}

export async function uploadFamilyPhotoToStorage(input: {
  file: File;
  storagePath: string;
}): Promise<string> {
  await ensurePhotoBucket();

  const db = getSupabaseServiceClient();
  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await db.storage
    .from(PHOTO_BUCKET)
    .upload(input.storagePath, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`[supabase] Failed to upload photo: ${error.message}`);
  }

  return input.storagePath;
}

// ============================================================
// T5: 음성 녹음 + raw_utterances
// ============================================================

export interface RawUtteranceRecord {
  id: string;
}

export interface RawUtteranceForResponse {
  id: string;
  elder_id: string;
  transcript: string;
}

export async function fetchRawUtteranceForResponse(
  utteranceId: string
): Promise<RawUtteranceForResponse | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("raw_utterances")
    .select("id, elder_id, transcript")
    .eq("id", utteranceId)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch raw_utterance: ${error.message}`);
  }

  return data as RawUtteranceForResponse | null;
}

/**
 * 음성 파일을 Supabase Storage 'utterances' 버킷에 업로드.
 * 반환값: storage_path (signed URL 아님 — 나중에 signed URL 생성 시 사용)
 */
export async function uploadAudioToStorage(
  file: File,
  storagePath: string
): Promise<string> {
  const db = getSupabaseServiceClient();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await db.storage
    .from("utterances")
    .upload(storagePath, buffer, {
      contentType: file.type || "audio/webm",
      upsert: false, // 중복 방지
    });

  if (error) {
    throw new Error(`[supabase] Failed to upload audio: ${error.message}`);
  }

  return storagePath;
}

/**
 * raw_utterances INSERT (immutable — 이 함수에서 UPDATE/DELETE 절대 금지)
 */
export async function insertRawUtterance(input: {
  elderId: string;
  promptId: string | null;
  sourcePhotoId: string | null;
  audioUrl: string | null;
  audioDurationSec: number;
  transcript: string;
  startedAt: string;
  endedAt: string;
}): Promise<RawUtteranceRecord> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("raw_utterances")
    .insert({
      elder_id: input.elderId,
      prompt_id: input.promptId,
      source_photo_id: input.sourcePhotoId,
      audio_url: input.audioUrl,
      audio_duration_sec: input.audioDurationSec,
      transcript: input.transcript,
      started_at: input.startedAt,
      ended_at: input.endedAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`[supabase] Failed to insert raw_utterance: ${error.message}`);
  }

  return data as RawUtteranceRecord;
}

const TTS_BUCKET = "tts-cache";

async function ensureTtsBucket(): Promise<void> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.storage.getBucket(TTS_BUCKET);

  if (!error && data) return;

  const { error: createError } = await db.storage.createBucket(TTS_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["audio/mpeg"],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`[supabase] Failed to ensure tts bucket: ${createError.message}`);
  }
}

export async function uploadTtsAudioAndCreateSignedUrl(input: {
  buffer: Buffer;
  storagePath: string;
}): Promise<string> {
  await ensureTtsBucket();

  const db = getSupabaseServiceClient();
  const { error } = await db.storage
    .from(TTS_BUCKET)
    .upload(input.storagePath, input.buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`[supabase] Failed to upload tts audio: ${error.message}`);
  }

  const { data, error: signError } = await db.storage
    .from(TTS_BUCKET)
    .createSignedUrl(input.storagePath, 60 * 10);

  if (signError) {
    throw new Error(`[supabase] Failed to sign tts audio: ${signError.message}`);
  }

  return data.signedUrl;
}
