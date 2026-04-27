/**
 * MOT — 공유 타입 정의
 */

// =====================================================
// DB 테이블 타입
// =====================================================

export interface DBUser {
  id: string;
  display_name: string;
  birth_year: number | null;
  gender: string | null;
  region_origin: string | null;
  region_current: string | null;
  dialect: string | null;
  phone_number: string | null;
  preferred_call_time: string;
  timezone: string;
  mode: 'normal' | 'terminal';
  is_active: boolean;
  onboarded_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DBSession {
  id: string;
  user_id: string;
  visit_attempt_id: string | null;
  channel: 'tablet' | 'phone' | 'web';
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  openai_session_id: string | null;
  post_processed: boolean;
  post_processed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DBUtteranceEvent {
  id: string;
  session_id: string;
  user_id: string;
  sequence_num: number;
  speaker: 'user' | 'assistant' | 'system';
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  text: string | null;
  text_confidence: number | null;
  audio_asset_id: string | null;
  audio_offset_ms: number | null;
  silence_before_ms: number | null;
  was_interrupted: boolean;
  was_self_initiated: boolean | null;
  emotion_hint: string | null;
  energy_level: number | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DBPersonaState {
  user_id: string;
  current_mood: string | null;
  current_energy: number | null;
  last_risk_score: number | null;
  recent_topics: unknown;
  recent_emotions: unknown;
  last_visit_at: string | null;
  consecutive_visits: number;
  active_thread_ids: string[] | null;
  pending_open_loop_ids: string[] | null;
  total_facts: number;
  total_entities: number;
  updated_at: string;
}

export interface DBSessionSummary {
  id: string;
  session_id: string;
  user_id: string;
  summary_short: string | null;
  summary_detailed: string | null;
  key_moments: unknown;
  emotion_arc: unknown;
  new_entities_count: number;
  new_facts_count: number;
  open_loops_created: number;
  dominant_themes: string[] | null;
  mentioned_entity_ids: string[] | null;
  created_at: string;
}

// =====================================================
// API 타입
// =====================================================

/** POST /api/visit/session — 요청 */
export interface CreateSessionRequest {
  userId: string;
  channel?: 'tablet' | 'phone' | 'web';
}

/** POST /api/visit/session — 응답 */
export interface CreateSessionResponse {
  sessionId: string;
  visitAttemptId: string;
  ephemeralToken: string;
  systemPrompt: string;
  model: string;
}

/** POST /api/visit/utterance — 요청 */
export interface SaveUtteranceRequest {
  sessionId: string;
  userId: string;
  speaker: 'user' | 'assistant' | 'system';
  text: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  silenceBeforeMs?: number;
  wasInterrupted?: boolean;
  wasSelfInitiated?: boolean;
  emotionHint?: string;
  rawData?: Record<string, unknown>;
}

/** POST /api/visit/utterance — 응답 */
export interface SaveUtteranceResponse {
  id: string;
  sequenceNum: number;
}

/** POST /api/visit/end — 요청 */
export interface EndSessionRequest {
  sessionId: string;
  userId: string;
}

/** POST /api/visit/end — 응답 */
export interface EndSessionResponse {
  success: boolean;
  sessionId: string;
  durationSeconds: number;
}

// =====================================================
// 방문 컨텍스트 (프롬프트 변수)
// =====================================================

export interface VisitContext {
  [key: string]: unknown;
  display_name: string;
  age: number | string;
  region_origin: string;
  dialect: string;
  personality_notes: string;
  recent_context: string;
  active_threads: string;
  recent_emotions: string;
  consecutive_visits: number;
  last_risk_score: string;
  today_seed: string;
  avoid_list: string;
}

// =====================================================
// WebRTC / Realtime 관련
// =====================================================

export type VisitPhase =
  | 'idle'        // 대기 화면
  | 'connecting'  // WebRTC 연결 중
  | 'active'      // 대화 진행 중
  | 'ending'      // 종료 중
  | 'ended';      // 종료 완료

export interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
