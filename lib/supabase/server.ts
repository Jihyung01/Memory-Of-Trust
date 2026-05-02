import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
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
    .from("photos")
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    throw new Error(`[supabase] Failed to sign photo URL: ${error.message}`);
  }

  return data.signedUrl;
}

// ============================================================
// T5: 음성 녹음 + raw_utterances
// ============================================================

export interface RawUtteranceRecord {
  id: string;
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

// ============================================================
// 다중 턴 대화 (S1-T2)
// ============================================================

/**
 * 같은 세션(최근 N분) 내 raw_utterances 조회 (시간 오름차순).
 */
export async function fetchRecentUtterancesInSession(
  elderId: string,
  withinMinutes: number = 30,
  limit: number = 5
): Promise<{ id: string; transcript: string; started_at: string }[]> {
  const db = getSupabaseServiceClient();
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("raw_utterances")
    .select("id, transcript, started_at")
    .eq("elder_id", elderId)
    .gte("started_at", since)
    .order("started_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`[supabase] Failed to fetch session utterances: ${error.message}`);
  }

  return (data ?? []) as { id: string; transcript: string; started_at: string }[];
}

export interface MemoryContextForResponse {
  recentUtterances: { id: string; transcript: string; started_at: string }[];
  entities: { name: string; relation: string | null; emotional_tone: string | null }[];
  themes: { theme: string; weight: number }[];
  unresolved: { type: string; excerpt: string }[];
  sensory: { sense: string; detail: string; context: string | null }[];
}

function truncateMemoryText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

/**
 * LLM 응답용 RAG 컨텍스트 조회.
 * raw_utterances는 SELECT만 수행한다. UPDATE/DELETE 금지.
 */
export async function fetchMemoryContextForResponse(
  elderId: string,
  currentUtteranceId?: string | null
): Promise<MemoryContextForResponse> {
  const db = getSupabaseServiceClient();

  const recentQuery = db
    .from("raw_utterances")
    .select("id, transcript, started_at")
    .eq("elder_id", elderId)
    .order("started_at", { ascending: false })
    .limit(5);

  if (currentUtteranceId) {
    recentQuery.neq("id", currentUtteranceId);
  }

  const [
    recentResult,
    entitiesResult,
    themesResult,
    unresolvedResult,
    sensoryResult,
  ] = await Promise.all([
    recentQuery,
    db
      .from("entities")
      .select("name, relation, emotional_tone")
      .eq("elder_id", elderId)
      .order("mention_count", { ascending: false })
      .limit(5),
    db
      .from("themes")
      .select("theme, weight")
      .eq("elder_id", elderId)
      .order("weight", { ascending: false })
      .limit(5),
    db
      .from("unresolved_queue")
      .select("type, excerpt")
      .eq("elder_id", elderId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(3),
    db
      .from("sensory_details")
      .select("sense, detail, context")
      .eq("elder_id", elderId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (recentResult.error) {
    throw new Error(`[supabase] fetchMemoryContext recent: ${recentResult.error.message}`);
  }
  if (entitiesResult.error) {
    throw new Error(`[supabase] fetchMemoryContext entities: ${entitiesResult.error.message}`);
  }
  if (themesResult.error) {
    throw new Error(`[supabase] fetchMemoryContext themes: ${themesResult.error.message}`);
  }
  if (unresolvedResult.error) {
    throw new Error(`[supabase] fetchMemoryContext unresolved: ${unresolvedResult.error.message}`);
  }
  if (sensoryResult.error) {
    throw new Error(`[supabase] fetchMemoryContext sensory: ${sensoryResult.error.message}`);
  }

  return {
    recentUtterances: ((recentResult.data ?? []) as {
      id: string;
      transcript: string;
      started_at: string;
    }[])
      .reverse()
      .map((utterance) => ({
        ...utterance,
        transcript: truncateMemoryText(utterance.transcript, 300),
      })),
    entities: ((entitiesResult.data ?? []) as {
      name: string;
      relation: string | null;
      emotional_tone: string | null;
    }[]).map((e) => ({ ...e, name: truncateMemoryText(e.name, 50) })),
    themes: ((themesResult.data ?? []) as { theme: string; weight: number }[]).map(
      (t) => ({ ...t, theme: truncateMemoryText(t.theme, 80) })
    ),
    unresolved: ((unresolvedResult.data ?? []) as { type: string; excerpt: string }[]).map(
      (u) => ({ ...u, excerpt: truncateMemoryText(u.excerpt, 200) })
    ),
    sensory: ((sensoryResult.data ?? []) as {
      sense: string;
      detail: string;
      context: string | null;
    }[]).map((s) => ({
      ...s,
      detail: truncateMemoryText(s.detail, 100),
      context: s.context ? truncateMemoryText(s.context, 100) : null,
    })),
  };
}

// ============================================================
// extraction_log
// ============================================================

/**
 * 새 발화에 대해 extraction_log에 pending 행 추가.
 */
export async function insertExtractionLog(input: {
  utteranceId: string;
  elderId: string;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("extraction_log")
    .insert({
      utterance_id: input.utteranceId,
      elder_id: input.elderId,
      status: "pending",
    });

  if (error) {
    throw new Error(`[supabase] Failed to insert extraction_log: ${error.message}`);
  }
}

/**
 * pending/failed 발화를 claim → processing으로 전환.
 * 각 행을 개별 UPDATE해서 attempt_count도 증가.
 */
export async function claimPendingExtractions(
  elderId: string | null,
  limit: number = 5
): Promise<{ id: string; utterance_id: string; elder_id: string; attempt_count: number }[]> {
  const db = getSupabaseServiceClient();

  let query = db
    .from("extraction_log")
    .select("id, utterance_id, elder_id, attempt_count")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", 3)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (elderId) {
    query = query.eq("elder_id", elderId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[supabase] Failed to query extraction_log: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  // Claim 각 행: status → processing, attempt_count 증가
  const claimed: { id: string; utterance_id: string; elder_id: string; attempt_count: number }[] = [];
  for (const row of data) {
    const typedRow = row as { id: string; utterance_id: string; elder_id: string; attempt_count: number };
    const { error: updateError } = await db
      .from("extraction_log")
      .update({
        status: "processing",
        attempt_count: typedRow.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", typedRow.id)
      .in("status", ["pending", "failed"]); // CAS: 다른 worker가 이미 processing이면 no-op

    if (!updateError) {
      claimed.push(typedRow);
    }
  }

  return claimed;
}

/**
 * extraction_log를 done으로 마킹.
 */
export async function markExtractionDone(logId: string): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("extraction_log")
    .update({
      status: "done",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    throw new Error(`[supabase] Failed to mark extraction done: ${error.message}`);
  }
}

/**
 * extraction_log를 failed로 마킹.
 */
export async function markExtractionFailed(
  logId: string,
  errorMsg: string
): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db
    .from("extraction_log")
    .update({
      status: "failed",
      last_error: errorMsg.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    throw new Error(`[supabase] Failed to mark extraction failed: ${error.message}`);
  }
}

/**
 * raw_utterance의 transcript 조회 (추출 파이프라인용).
 */
export async function fetchUtteranceTranscript(
  utteranceId: string
): Promise<{ transcript: string; elder_id: string } | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("raw_utterances")
    .select("transcript, elder_id")
    .eq("id", utteranceId)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] Failed to fetch utterance: ${error.message}`);
  }

  return data as { transcript: string; elder_id: string } | null;
}

// ============================================================
// 8축 INSERT 헬퍼 (S1-T3)
// ============================================================

export async function insertTimelineEvent(input: {
  elderId: string;
  utteranceId: string;
  title: string;
  approximateYear?: number | null;
  approximateAge?: number | null;
  description?: string | null;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("timeline_events").insert({
    elder_id: input.elderId,
    title: input.title,
    approximate_year: input.approximateYear ?? null,
    approximate_age: input.approximateAge ?? null,
    description: input.description ?? null,
    source_utterance_ids: [input.utteranceId],
  });
  if (error) throw new Error(`[supabase] insertTimelineEvent: ${error.message}`);
}

export async function upsertEntity(input: {
  elderId: string;
  utteranceId: string;
  name: string;
  relation?: string | null;
  emotionalTone?: string | null;
}): Promise<void> {
  const db = getSupabaseServiceClient();

  // UPSERT: 같은 (elder_id, name)이면 mention_count 증가
  const { data: existing } = await db
    .from("entities")
    .select("id, mention_count, source_utterance_ids")
    .eq("elder_id", input.elderId)
    .eq("name", input.name)
    .maybeSingle();

  if (existing) {
    const ids = (existing.source_utterance_ids ?? []) as string[];
    if (!ids.includes(input.utteranceId)) ids.push(input.utteranceId);
    await db
      .from("entities")
      .update({
        mention_count: (existing.mention_count ?? 1) + 1,
        relation: input.relation ?? undefined,
        emotional_tone: input.emotionalTone ?? undefined,
        source_utterance_ids: ids,
      })
      .eq("id", existing.id);
  } else {
    const { error } = await db.from("entities").insert({
      elder_id: input.elderId,
      name: input.name,
      relation: input.relation ?? null,
      emotional_tone: input.emotionalTone ?? null,
      mention_count: 1,
      source_utterance_ids: [input.utteranceId],
    });
    if (error) throw new Error(`[supabase] upsertEntity: ${error.message}`);
  }
}

export async function insertTheme(input: {
  elderId: string;
  utteranceId: string;
  theme: string;
  weight?: number;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("themes").insert({
    elder_id: input.elderId,
    theme: input.theme,
    weight: input.weight ?? 1.0,
    source_utterance_ids: [input.utteranceId],
  });
  if (error) throw new Error(`[supabase] insertTheme: ${error.message}`);
}

export async function insertEmotionLayer(input: {
  elderId: string;
  utteranceId: string;
  emotion: string;
  intensity: number;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("emotion_layer").insert({
    elder_id: input.elderId,
    utterance_id: input.utteranceId,
    emotion: input.emotion,
    intensity: Math.min(5, Math.max(1, input.intensity)),
  });
  if (error) throw new Error(`[supabase] insertEmotionLayer: ${error.message}`);
}

export async function insertUnresolvedItem(input: {
  elderId: string;
  utteranceId: string;
  type: string;
  towardEntityId?: string | null;
  excerpt: string;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("unresolved_queue").insert({
    elder_id: input.elderId,
    utterance_id: input.utteranceId,
    type: input.type,
    toward_entity_id: input.towardEntityId ?? null,
    excerpt: input.excerpt,
    status: "open",
  });
  if (error) throw new Error(`[supabase] insertUnresolvedItem: ${error.message}`);
}

export async function insertSensoryDetail(input: {
  elderId: string;
  utteranceId: string;
  sense: string;
  detail: string;
  context?: string | null;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("sensory_details").insert({
    elder_id: input.elderId,
    utterance_id: input.utteranceId,
    sense: input.sense,
    detail: input.detail,
    context: input.context ?? null,
  });
  if (error) throw new Error(`[supabase] insertSensoryDetail: ${error.message}`);
}

export async function insertMemoryCandidate(input: {
  elderId: string;
  utteranceId: string;
  fact: string;
  confidence: number;
  needsFamilyCheck: boolean;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.from("memory_candidates").insert({
    elder_id: input.elderId,
    utterance_id: input.utteranceId,
    fact: input.fact,
    confidence: input.confidence,
    needs_family_check: input.needsFamilyCheck,
    status: "candidate",
  });
  if (error) throw new Error(`[supabase] insertMemoryCandidate: ${error.message}`);
}

// ============================================================
// T4: 주간/월간 데이터 조회 + story_outputs UPSERT
// ============================================================

export async function fetchTimelineEventsInRange(
  elderId: string,
  startUtc: string,
  endUtc: string
): Promise<{ title: string; approximate_year: number | null; description: string | null }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("timeline_events")
    .select("title, approximate_year, description")
    .eq("elder_id", elderId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (error) throw new Error(`[supabase] fetchTimelineEvents: ${error.message}`);
  return (data ?? []) as { title: string; approximate_year: number | null; description: string | null }[];
}

export async function fetchThemesInRange(
  elderId: string,
  startUtc: string,
  endUtc: string
): Promise<{ theme: string; weight: number }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("themes")
    .select("theme, weight")
    .eq("elder_id", elderId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (error) throw new Error(`[supabase] fetchThemes: ${error.message}`);
  return (data ?? []) as { theme: string; weight: number }[];
}

export async function fetchSensoryDetailsInRange(
  elderId: string,
  startUtc: string,
  endUtc: string
): Promise<{ sense: string; detail: string; context: string | null }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("sensory_details")
    .select("sense, detail, context")
    .eq("elder_id", elderId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (error) throw new Error(`[supabase] fetchSensoryDetails: ${error.message}`);
  return (data ?? []) as { sense: string; detail: string; context: string | null }[];
}

export async function fetchOpenUnresolved(
  elderId: string
): Promise<{ type: string; excerpt: string }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("unresolved_queue")
    .select("type, excerpt")
    .eq("elder_id", elderId)
    .eq("status", "open");
  if (error) throw new Error(`[supabase] fetchOpenUnresolved: ${error.message}`);
  return (data ?? []) as { type: string; excerpt: string }[];
}

export async function fetchTopEntities(
  elderId: string,
  limit: number = 10
): Promise<{ name: string; emotional_tone: string | null; mention_count: number }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("entities")
    .select("name, emotional_tone, mention_count")
    .eq("elder_id", elderId)
    .order("mention_count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[supabase] fetchTopEntities: ${error.message}`);
  return (data ?? []) as { name: string; emotional_tone: string | null; mention_count: number }[];
}

export async function fetchMemoryCandidatesInRange(
  elderId: string,
  startUtc: string,
  endUtc: string
): Promise<{ fact: string; confidence: number; needs_family_check: boolean }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("memory_candidates")
    .select("fact, confidence, needs_family_check")
    .eq("elder_id", elderId)
    .gte("created_at", startUtc)
    .lt("created_at", endUtc);
  if (error) throw new Error(`[supabase] fetchMemoryCandidates: ${error.message}`);
  return (data ?? []) as { fact: string; confidence: number; needs_family_check: boolean }[];
}

export async function fetchUtteranceIdsInRange(
  elderId: string,
  startUtc: string,
  endUtc: string
): Promise<string[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("raw_utterances")
    .select("id")
    .eq("elder_id", elderId)
    .gte("started_at", startUtc)
    .lt("started_at", endUtc);
  if (error) throw new Error(`[supabase] fetchUtteranceIds: ${error.message}`);
  return (data ?? []).map((d: { id: string }) => d.id);
}

/**
 * story_outputs UPSERT — (elder_id, output_type, title) 충돌 시 UPDATE.
 */
export async function upsertStoryOutput(input: {
  elderId: string;
  outputType: string;
  title: string;
  content: string;
  sourceUtteranceIds: string[];
  generatedByModel: string;
}): Promise<{ id: string; created: boolean }> {
  const db = getSupabaseServiceClient();

  // 기존 행 확인
  const { data: existing } = await db
    .from("story_outputs")
    .select("id")
    .eq("elder_id", input.elderId)
    .eq("output_type", input.outputType)
    .eq("title", input.title)
    .maybeSingle();

  if (existing) {
    // UPDATE
    const { error } = await db
      .from("story_outputs")
      .update({
        content: input.content,
        source_utterance_ids: input.sourceUtteranceIds,
        generated_by_model: input.generatedByModel,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`[supabase] upsertStoryOutput update: ${error.message}`);
    return { id: existing.id, created: false };
  } else {
    // INSERT
    const { data, error } = await db
      .from("story_outputs")
      .insert({
        elder_id: input.elderId,
        output_type: input.outputType,
        title: input.title,
        content: input.content,
        source_utterance_ids: input.sourceUtteranceIds,
        generated_by_model: input.generatedByModel,
      })
      .select("id")
      .single();
    if (error) throw new Error(`[supabase] upsertStoryOutput insert: ${error.message}`);
    return { id: (data as { id: string }).id, created: true };
  }
}

// ============================================================
// active elders 조회 (Cron용)
// ============================================================

export async function fetchActiveElders(): Promise<{ id: string; name: string; display_name: string | null }[]> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("elders")
    .select("id, name, display_name")
    .eq("active", true);

  if (error) {
    throw new Error(`[supabase] Failed to fetch active elders: ${error.message}`);
  }

  return (data ?? []) as { id: string; name: string; display_name: string | null }[];
}

// ============================================================
// §dev. 개발 전용 — raw token 폴백 (Phase 2 진입 시 제거)
// ============================================================

export async function fetchDeviceByRawTokenDev(
  rawToken: string
): Promise<DeviceAuthRecord | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("devices")
    .select("id, elder_id")
    .eq("device_token", rawToken)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] fetchDeviceByRawTokenDev: ${error.message}`);
  }

  return data as DeviceAuthRecord | null;
}

// ============================================================
// §llm. LLM 응답용 utterance 조회
// ============================================================

export async function fetchRawUtteranceForResponse(
  utteranceId: string
): Promise<{ transcript: string; elder_id: string } | null> {
  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from("raw_utterances")
    .select("transcript, elder_id")
    .eq("id", utteranceId)
    .maybeSingle();

  if (error) {
    throw new Error(`[supabase] fetchRawUtteranceForResponse: ${error.message}`);
  }

  return data as { transcript: string; elder_id: string } | null;
}

// ============================================================
// §tts. TTS 오디오 업로드 + signed URL
// ============================================================

export async function uploadTtsAudioAndCreateSignedUrl(input: {
  buffer: Buffer;
  storagePath: string;
}): Promise<string> {
  const db = getSupabaseServiceClient();
  const { error: uploadError } = await db.storage
    .from("tts-audio")
    .upload(input.storagePath, input.buffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`[supabase] TTS audio upload failed: ${uploadError.message}`);
  }

  const { data: signedData, error: signError } = await db.storage
    .from("tts-audio")
    .createSignedUrl(input.storagePath, 3600);

  if (signError || !signedData?.signedUrl) {
    throw new Error(`[supabase] TTS signed URL failed: ${signError?.message}`);
  }

  return signedData.signedUrl;
}

// ============================================================
// §photos. 가족 사진 스토리지 업로드
// ============================================================

export async function uploadFamilyPhotoToStorage(input: {
  file: File;
  storagePath: string;
}): Promise<void> {
  const db = getSupabaseServiceClient();
  const { error } = await db.storage
    .from("family-photos")
    .upload(input.storagePath, input.file, {
      contentType: input.file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(`[supabase] Family photo upload failed: ${error.message}`);
  }
}
