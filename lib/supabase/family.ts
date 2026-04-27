import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env";

export interface FamilyMemberRecord {
  id: string;
  elder_id: string;
}

export interface FamilyUtteranceRecord {
  id: string;
  transcript: string;
  started_at: string;
}

export interface UploadedPhotoRecord {
  id: string;
}

export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  return createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function fetchFirstFamilyMember(
  db: SupabaseClient
): Promise<FamilyMemberRecord | null> {
  const { data, error } = await db
    .from("family_members")
    .select("id, elder_id")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch family member: ${error.message}`);
  }

  return data as FamilyMemberRecord | null;
}

export async function fetchFamilyMemberForElder(
  db: SupabaseClient,
  elderId: string
): Promise<FamilyMemberRecord | null> {
  const { data, error } = await db
    .from("family_members")
    .select("id, elder_id")
    .eq("elder_id", elderId)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch family member: ${error.message}`);
  }

  return data as FamilyMemberRecord | null;
}

export async function fetchRecentRawUtterances(
  db: SupabaseClient,
  elderId: string
): Promise<FamilyUtteranceRecord[]> {
  const { data, error } = await db
    .from("raw_utterances")
    .select("id, transcript, started_at")
    .eq("elder_id", elderId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`[supabase] Failed to fetch raw utterances: ${error.message}`);
  }

  return (data ?? []) as FamilyUtteranceRecord[];
}

export async function uploadFamilyPhoto(input: {
  db: SupabaseClient;
  file: File;
  storagePath: string;
}): Promise<string> {
  const { error } = await input.db.storage
    .from("photos")
    .upload(input.storagePath, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`[supabase] Failed to upload photo: ${error.message}`);
  }

  return input.storagePath;
}

export async function insertFamilyPhoto(input: {
  db: SupabaseClient;
  elderId: string;
  uploadedBy: string;
  storagePath: string;
  caption: string | null;
  approximateYear: number | null;
  peopleInPhoto: string[] | null;
}): Promise<UploadedPhotoRecord> {
  const { data, error } = await input.db
    .from("photos")
    .insert({
      elder_id: input.elderId,
      uploaded_by: input.uploadedBy,
      storage_path: input.storagePath,
      caption: input.caption,
      approximate_year: input.approximateYear,
      people_in_photo: input.peopleInPhoto,
      active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`[supabase] Failed to insert photo: ${error.message}`);
  }

  return data as UploadedPhotoRecord;
}
