import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

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
    .order("created_at", { ascending: true })
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
  photoId: string;
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
    .from("photos")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw new Error(`[supabase] Failed to sign photo URL: ${error.message}`);
  }

  return data.signedUrl;
}
