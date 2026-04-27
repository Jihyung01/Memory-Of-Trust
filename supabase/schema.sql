-- =====================================================
-- MOT (Memory Of Trust) — Supabase Schema v1
-- =====================================================
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor → New query
--   2. 이 파일 전체 복붙
--   3. Run
--   4. 맨 아래 확인 쿼리에서 "설치 완료" 메시지 확인
--
-- 설계 철학:
--   - 원본은 절대 덮어쓰지 않는다 (event sourcing)
--   - 정제는 삭제가 아니라 파생 (candidates → facts)
--   - 기억은 층으로 나눈다 (raw / structured / generated / delivery)
--   - 모든 AI 추출은 후보로 저장, 검증 거쳐 사실로 승격
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 이름 유사도 검색용

-- =====================================================
-- LAYER 0: IDENTITY & CONSENT (사용자, 가족, 동의)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기본 신원
  display_name TEXT NOT NULL,           -- "영숙 씨"
  birth_year INT,
  gender TEXT,
  region_origin TEXT,                   -- 출신 지역
  region_current TEXT,                  -- 현재 거주지
  dialect TEXT,                         -- 주사투리 (경상/전라/충청/...)
  
  -- 연락
  phone_number TEXT UNIQUE,
  preferred_call_time TIME DEFAULT '19:00:00',
  timezone TEXT DEFAULT 'Asia/Seoul',
  
  -- 서비스 모드
  mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'terminal')),
  -- terminal = Final Visitor 모드 (v2)
  
  -- 상태
  is_active BOOLEAN DEFAULT true,
  onboarded_at TIMESTAMPTZ,
  
  -- 메타
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 가족 계정 (가족 대시보드 로그인 주체)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  auth_user_id UUID,                    -- Supabase Auth 연결 (옵션)
  phone_number TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 사용자 ↔ 가족 연결
CREATE TABLE IF NOT EXISTS family_user_links (
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  relation TEXT,                        -- son | daughter | grandchild | spouse | sibling | caregiver
  access_level TEXT DEFAULT 'viewer',   -- viewer | manager | admin
  is_primary_contact BOOLEAN DEFAULT false,
  receive_daily_cards BOOLEAN DEFAULT true,
  receive_risk_alerts BOOLEAN DEFAULT true,
  
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  PRIMARY KEY (family_member_id, user_id)
);

-- 동의 기록 (법적·윤리적)
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'data_collection',      -- 기본 데이터 수집
    'audio_recording',      -- 음성 녹음 저장
    'family_sharing',       -- 가족 공유
    'post_mortem_delivery', -- 사후 전달 (v2)
    'research_use',         -- 비식별 연구 활용
    'long_term_storage'     -- 장기 보존
  )),
  
  granted_by TEXT CHECK (granted_by IN ('self', 'guardian', 'family_member')),
  granted_by_family_id UUID REFERENCES family_members(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  
  -- 동의 시점의 문구 스냅샷 (법적 방어용)
  document_snapshot TEXT,
  version TEXT,                         -- "consent-v1.0"
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_user ON consent_records(user_id, consent_type);

-- =====================================================
-- LAYER 1: RAW VAULT (절대 불변 원본 — 이벤트 소싱)
-- =====================================================

-- 방문 시도 (전화 걸었으나 안 받았어도 기록)
CREATE TABLE IF NOT EXISTS visit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ,
  
  channel TEXT CHECK (channel IN ('tablet', 'phone', 'web')),
  result TEXT CHECK (result IN (
    'answered',           -- 응답
    'no_answer',          -- 무응답
    'declined',           -- 거절
    'technical_error',    -- 기술 오류
    'silent_session'      -- 연결은 됐으나 대화 없음
  )),
  
  session_id UUID,                      -- 성공 시 연결
  retry_count INT DEFAULT 0,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 대화 세션 (메타 정보만)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visit_attempt_id UUID REFERENCES visit_attempts(id),
  
  channel TEXT CHECK (channel IN ('tablet', 'phone', 'web')),
  mode TEXT DEFAULT 'normal',           -- normal | final_visitor
  
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- OpenAI Realtime 세션 ID (추적용)
  openai_session_id TEXT,
  
  -- 처리 상태
  post_processed BOOLEAN DEFAULT false,
  post_processed_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_unprocessed ON sessions(post_processed, started_at) 
  WHERE post_processed = false;

-- 발화 이벤트 (event sourcing의 심장)
CREATE TABLE IF NOT EXISTS utterance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  sequence_num INT NOT NULL,            -- 세션 내 순서
  speaker TEXT CHECK (speaker IN ('user', 'assistant', 'system')) NOT NULL,
  
  -- 시간
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- 내용
  text TEXT,                            -- STT 결과
  text_confidence FLOAT,                -- STT 신뢰도
  
  -- 음성 원본 참조
  audio_asset_id UUID,                  -- audio_assets 참조
  audio_offset_ms INT,                  -- 전체 오디오 파일 내 시작 위치
  
  -- 대화 행동 정보
  silence_before_ms INT,                -- 이 발화 전 침묵
  was_interrupted BOOLEAN DEFAULT false, -- 중단됐는가
  was_self_initiated BOOLEAN,           -- 사용자가 먼저 꺼냈나 (assistant 질문에 대한 답인가)
  
  -- 실시간 감지 힌트 (nullable)
  emotion_hint TEXT,                    -- realtime 감지된 감정 (부정확함, 힌트용)
  energy_level FLOAT,                   -- 음성 에너지
  
  -- 메타
  raw_data JSONB,                       -- 원본 이벤트 데이터
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(session_id, sequence_num)
);

CREATE INDEX idx_utterances_session ON utterance_events(session_id, sequence_num);
CREATE INDEX idx_utterances_user_time ON utterance_events(user_id, started_at DESC);

-- 음성 파일 자산
CREATE TABLE IF NOT EXISTS audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  storage_path TEXT NOT NULL,           -- Supabase Storage 경로
  format TEXT,                          -- opus | wav | mp3
  duration_ms INT,
  size_bytes BIGINT,
  
  -- 보존 정책
  retention_policy TEXT DEFAULT 'permanent',
  -- permanent | 1year | 7years | user_lifetime
  retention_until TIMESTAMPTZ,
  
  -- 무결성
  sha256_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audio_user ON audio_assets(user_id, created_at DESC);

-- =====================================================
-- LAYER 2A: ENTITIES (통합 개체 레지스트리)
-- =====================================================

-- 모든 개체 (사람, 장소, 사물, 사건, 조직, 시대, 음식, 노래 등)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- 분류
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person',             -- 사람
    'place',              -- 장소
    'object',             -- 사물
    'organization',       -- 조직·회사·학교
    'event',              -- 역사적 사건
    'era',                -- 시대
    'food',               -- 음식
    'song',               -- 노래
    'media',              -- 영화·책·방송
    'animal',             -- 동물·반려
    'condition'           -- 질병·증상
  )),
  
  -- 이름
  name TEXT NOT NULL,                   -- 사용자가 부르는 이름
  formal_name TEXT,                     -- 정식 명칭
  aliases TEXT[],                       -- 별명·다른 호칭
  
  -- 설명
  description TEXT,
  
  -- 타입별 속성 (JSONB)
  attributes JSONB DEFAULT '{}'::jsonb,
  -- person: {relation, relation_detail, is_alive, year_met, year_parted, parting_reason,
  --          emotional_valence, unresolved, message_to_them}
  -- place: {place_type, era_associated, still_exists, last_visited_year, sensory_anchors}
  -- object: {significance, still_owned, year_acquired}
  -- event: {year, personal_experience, significance}
  -- food: {era_associated, prepared_by, context}
  
  -- 언급 추적
  mention_count INT DEFAULT 1,
  first_mentioned_at TIMESTAMPTZ DEFAULT now(),
  last_mentioned_at TIMESTAMPTZ DEFAULT now(),
  first_event_id UUID,                  -- 처음 언급된 utterance_event
  
  -- 의미 검색
  embedding VECTOR(1536),
  
  -- 메타
  confidence FLOAT DEFAULT 0.5,         -- AI가 이 엔티티 식별에 얼마나 확신하는가
  merged_into UUID REFERENCES entities(id), -- 나중에 다른 엔티티와 동일 판명 시
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entities_user_type ON entities(user_id, entity_type);
CREATE INDEX idx_entities_mention ON entities(user_id, mention_count DESC);
CREATE INDEX idx_entities_embedding ON entities USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_entities_name_trgm ON entities USING gin(name gin_trgm_ops);

-- 엔티티 간 관계 (그래프)
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  subject_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE NOT NULL,
  object_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  -- object가 null이면 subject가 user 자신과의 관계
  
  predicate TEXT NOT NULL,              -- knows | loves | born_in | works_at | married_to | lost | happened_at ...
  
  strength FLOAT DEFAULT 0.5,           -- 관계 강도
  valence FLOAT,                        -- 감정 극성 (-1 ~ 1)
  
  -- 시간성
  temporal_start INT,                   -- 연도
  temporal_end INT,
  era TEXT,
  
  -- 증거
  evidence_event_ids UUID[],            -- 이 관계를 뒷받침하는 utterance_events
  evidence_fact_ids UUID[],             -- 관련 memory_facts
  
  description TEXT,
  confidence FLOAT DEFAULT 0.5,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_relationships_subject ON relationships(subject_entity_id);
CREATE INDEX idx_relationships_object ON relationships(object_entity_id);
CREATE INDEX idx_relationships_user ON relationships(user_id, predicate);

-- =====================================================
-- LAYER 2B: MEMORY (후보 → 사실)
-- =====================================================

-- 기억 후보 — AI가 추출한 것. 아직 검증 전.
CREATE TABLE IF NOT EXISTS memory_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- 출처
  source_event_ids UUID[] NOT NULL,     -- utterance_events
  
  -- 내용
  summary TEXT NOT NULL,
  full_text TEXT,                       -- 원문 발췌 (고치지 않음)
  narrative_role TEXT,                  -- scene | reflection | dialogue | anecdote | confession
  
  -- 추출된 메타
  era TEXT,
  year_approx INT,
  season TEXT,
  time_of_day TEXT,
  weather TEXT,
  location_entity_id UUID REFERENCES entities(id),
  
  sensory JSONB,                        -- {smell, sound, taste, touch, sight}
  mentioned_entity_ids UUID[],          -- 언급된 모든 엔티티
  
  emotions JSONB,                       -- [{emotion, intensity, note}]
  themes TEXT[],
  
  trigger_context TEXT,                 -- 어떤 맥락에서 나왔나
  resolution_status TEXT DEFAULT 'complete', -- complete | incomplete | avoided
  
  -- 승격 관련
  confidence FLOAT DEFAULT 0.5,
  significance FLOAT DEFAULT 0.5,
  significance_reason TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',            -- 검증 대기
    'promoted',           -- 사실로 승격됨
    'rejected',           -- 오류로 판단
    'needs_review',       -- 사람 검토 필요
    'merged'              -- 기존 사실과 병합됨
  )),
  promoted_to_fact_id UUID,
  rejection_reason TEXT,
  
  -- 힌트 (후처리에서 다른 테이블로 이어지는)
  is_wisdom BOOLEAN DEFAULT false,
  is_identity_statement BOOLEAN DEFAULT false,
  is_body_memory BOOLEAN DEFAULT false,
  contains_message_to_someone JSONB,    -- {detected, recipient, intent, paraphrased}
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_candidates_status ON memory_candidates(status, created_at);
CREATE INDEX idx_candidates_user ON memory_candidates(user_id, created_at DESC);

-- 기억 사실 — 검증된 기억
CREATE TABLE IF NOT EXISTS memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- 출처
  origin_candidate_id UUID REFERENCES memory_candidates(id),
  source_event_ids UUID[] NOT NULL,
  related_fact_ids UUID[],              -- 같은 사건의 다른 증언 등
  
  -- 내용 (후보에서 승격 시 복사)
  summary TEXT NOT NULL,
  full_text TEXT,
  narrative_role TEXT,
  
  era TEXT,
  year_approx INT,
  season TEXT,
  time_of_day TEXT,
  weather TEXT,
  location_entity_id UUID REFERENCES entities(id),
  
  sensory JSONB,
  mentioned_entity_ids UUID[],
  emotions JSONB,
  themes TEXT[],
  
  significance FLOAT DEFAULT 0.5,
  
  -- 검증
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,                     -- ai | family | self
  verification_method TEXT,             -- confidence_threshold | cross_reference | manual
  verified_at TIMESTAMPTZ,
  
  -- 임베딩
  embedding VECTOR(1536),
  
  -- 생애 이벤트 연결
  life_event_id UUID,
  
  -- 버전
  version INT DEFAULT 1,
  superseded_by UUID REFERENCES memory_facts(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facts_user ON memory_facts(user_id, created_at DESC);
CREATE INDEX idx_facts_embedding ON memory_facts USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_facts_themes ON memory_facts USING gin(themes);
CREATE INDEX idx_facts_era ON memory_facts(user_id, era);

-- 생애 이벤트 (큰 단위의 사건)
CREATE TABLE IF NOT EXISTS life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,                  -- "서울 상경"
  event_type TEXT,                      -- birth | death | marriage | migration | illness | 
                                        -- career_change | loss | achievement | trauma | reunion
  
  year_approx INT,
  year_range INT4RANGE,                 -- 기간이 있는 경우
  era TEXT,
  
  description TEXT,
  
  involved_entity_ids UUID[],
  related_fact_ids UUID[],
  
  significance FLOAT DEFAULT 0.5,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_life_events_user ON life_events(user_id, year_approx);

-- 열린 루프 — 미해결 주제, 다시 돌아와야 할 것
CREATE TABLE IF NOT EXISTS open_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  topic TEXT NOT NULL,
  type TEXT CHECK (type IN (
    'avoided',              -- 사용자가 피함
    'interrupted',          -- 말 끊김
    'promised_to_return',   -- 다음에 얘기하기로 함
    'partial_answer'        -- 부분만 답함
  )),
  
  detected_in_session UUID REFERENCES sessions(id),
  detected_in_event_id UUID REFERENCES utterance_events(id),
  
  related_entity_ids UUID[],
  related_theme TEXT,
  
  priority FLOAT DEFAULT 0.5,
  retry_after_days INT DEFAULT 7,
  last_attempted_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'resolved', 
    'respected_silence'   -- 3회 이상 회피 → 더 이상 묻지 않음
  )),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_open_loops_active ON open_loops(user_id, status, priority DESC) 
  WHERE status = 'pending';

-- 감정 흐름
CREATE TABLE IF NOT EXISTS emotion_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  
  measured_at TIMESTAMPTZ DEFAULT now(),
  
  emotions JSONB NOT NULL,              -- {joy: 0.3, sadness: 0.6, nostalgia: 0.8, ...}
  dominant_emotion TEXT,
  energy FLOAT,
  
  -- 추세 비교용
  baseline_deviation FLOAT,             -- 사용자 평균 대비 편차
  
  notes TEXT
);

CREATE INDEX idx_emotions_user_time ON emotion_traces(user_id, measured_at DESC);

-- 위험 신호
CREATE TABLE IF NOT EXISTS risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES sessions(id),
  event_id UUID REFERENCES utterance_events(id),
  
  category TEXT NOT NULL CHECK (category IN (
    'suicidal_ideation',
    'severe_depression',
    'acute_loneliness',
    'cognitive_decline',
    'physical_distress',
    'abuse_neglect',
    'financial_distress'
  )),
  
  severity FLOAT NOT NULL,              -- 0 ~ 1
  evidence TEXT,                        -- 원문 증거
  reasoning TEXT,                       -- AI 추론 근거
  
  action_taken TEXT CHECK (action_taken IN (
    'none',
    'logged',
    'family_notified',
    'urgent_contact',
    'professional_referral'
  )),
  action_taken_at TIMESTAMPTZ,
  
  resolved BOOLEAN DEFAULT false,
  resolved_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risks_user ON risk_signals(user_id, created_at DESC);
CREATE INDEX idx_risks_unresolved ON risk_signals(resolved, severity DESC) 
  WHERE resolved = false;

-- 지혜 조각 (본인이 말한 삶의 통찰)
CREATE TABLE IF NOT EXISTS wisdom_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  source_fact_id UUID REFERENCES memory_facts(id),
  
  quote TEXT NOT NULL,                  -- "사람은 결국 혼자 가는 거야"
  context TEXT,
  domain TEXT,                          -- life | love | family | work | death
  legacy_worthy BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 정체성 특성
CREATE TABLE IF NOT EXISTS identity_traits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  trait TEXT NOT NULL,                  -- "나는 잘 참는 사람이다"
  category TEXT,                        -- character | value | role | self_image
  evidence_fact_ids UUID[],
  stated_count INT DEFAULT 1,
  is_positive BOOLEAN,
  
  first_stated_at TIMESTAMPTZ DEFAULT now()
);

-- 몸의 기억
CREATE TABLE IF NOT EXISTS body_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  type TEXT,                            -- scar | surgery | illness | habit | injury
  description TEXT NOT NULL,
  year_approx INT,
  related_fact_id UUID REFERENCES memory_facts(id),
  still_affects BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 말투 프로필
CREATE TABLE IF NOT EXISTS speech_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  phrase TEXT NOT NULL,
  phrase_type TEXT,                     -- filler | exclamation | idiom | dialect
  frequency INT DEFAULT 1,
  context_examples TEXT[]
);

-- =====================================================
-- LAYER 2C: AI OPERATIONAL (대화 재활성화용)
-- =====================================================

-- 페르소나 상태 — 매 세션 컨텍스트 주입 전 조회
CREATE TABLE IF NOT EXISTS persona_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  
  -- 현재 상태
  current_mood TEXT,
  current_energy FLOAT,
  last_risk_score FLOAT,
  
  -- 최근 맥락
  recent_topics JSONB,                  -- 최근 N개 세션의 주제
  recent_emotions JSONB,                -- 감정 추세
  last_visit_at TIMESTAMPTZ,
  consecutive_visits INT DEFAULT 0,     -- 연속 응답일
  
  -- 활성 요소
  active_thread_ids UUID[],             -- 진행 중 생애 스레드
  pending_open_loop_ids UUID[],
  
  -- 통계
  total_facts INT DEFAULT 0,
  total_entities INT DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 세션 요약
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  summary_short TEXT,                   -- 한 줄 ("어제는 도랑 얘기")
  summary_detailed TEXT,                -- 한 문단
  
  key_moments JSONB,                    -- 중요 순간 (감정 피크 등)
  emotion_arc JSONB,                    -- 감정 흐름
  
  new_entities_count INT DEFAULT 0,
  new_facts_count INT DEFAULT 0,
  open_loops_created INT DEFAULT 0,
  
  dominant_themes TEXT[],
  mentioned_entity_ids UUID[],
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_summaries_user ON session_summaries(user_id, created_at DESC);

-- 생애 스레드 (v2에서 본격 활용, v1에선 schema만)
CREATE TABLE IF NOT EXISTS life_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,                  -- "남편과의 결혼생활"
  thread_type TEXT,                     -- relationship | career | illness | migration | loss
  
  era_span TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'dormant')),
  
  summary TEXT,
  related_fact_ids UUID[],
  related_entity_ids UUID[],
  unresolved_questions TEXT[],
  
  last_touched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- LAYER 3: GENERATED CONTENT (정제된 산출물)
-- =====================================================

CREATE TABLE IF NOT EXISTS generated_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  content_type TEXT NOT NULL CHECK (content_type IN (
    'letter',           -- 기억 편지 (본인 낭독용)
    'card',             -- 가족 카드 (알림톡 랜딩용)
    'drama_script',     -- 드라마 대본 (v2)
    'drama_audio',      -- 드라마 오디오 (v2)
    'memoir_chapter',   -- 자서전 챕터 (v3)
    'illustration',     -- 이미지 (v2)
    'song'              -- 노래 (v2)
  )),
  
  title TEXT,
  body TEXT,                            -- 편지 본문, 대본 등
  
  -- 미디어
  audio_url TEXT,                       -- TTS 음성 (편지 낭독)
  image_url TEXT,                       -- 그림 카드
  
  -- 출처
  source_fact_ids UUID[],
  source_session_ids UUID[],
  
  -- 생성 추적 (재현성)
  prompt_template_name TEXT,
  prompt_version TEXT,
  generation_meta JSONB,                -- 모델, 파라미터 등
  
  -- 공유
  share_slug TEXT UNIQUE,               -- URL-safe 고유 슬러그
  is_public BOOLEAN DEFAULT false,
  
  -- 상태
  version INT DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'delivered', 'archived')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contents_user_type ON generated_contents(user_id, content_type, created_at DESC);
CREATE INDEX idx_contents_slug ON generated_contents(share_slug) WHERE share_slug IS NOT NULL;

-- =====================================================
-- LAYER 4: DELIVERY (전달)
-- =====================================================

-- 전달 이벤트 (모든 outbound 전송 로그)
CREATE TABLE IF NOT EXISTS delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES generated_contents(id),
  
  delivery_type TEXT NOT NULL,          -- daily_card | risk_alert | scheduled_message | custom
  
  -- 수신자
  recipient_family_id UUID REFERENCES family_members(id),
  recipient_name_snapshot TEXT,         -- 가족 이름 스냅샷
  recipient_contact TEXT,
  recipient_relation TEXT,
  
  -- 채널
  channel TEXT CHECK (channel IN ('kakao_alimtalk', 'sms', 'email', 'web', 'in_app_push')),
  channel_reference TEXT,               -- 알림톡 메시지 ID 등
  
  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'delivered', 'read', 'failed'
  )),
  
  -- 타임라인
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_delivery_user ON delivery_events(user_id, created_at DESC);
CREATE INDEX idx_delivery_pending ON delivery_events(status, scheduled_at) 
  WHERE status = 'pending';

-- 예약 전달 (v2 기능이지만 schema는 미리)
CREATE TABLE IF NOT EXISTS scheduled_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- 콘텐츠 (이미 생성됨) 또는 원본 (나중에 생성)
  content_id UUID REFERENCES generated_contents(id),
  raw_message TEXT,
  raw_audio_url TEXT,
  
  -- 수신자
  recipient_name TEXT NOT NULL,
  recipient_relation TEXT,
  recipient_contact TEXT,
  
  -- 전달 조건
  deliver_condition TEXT CHECK (deliver_condition IN (
    'date',               -- 특정 날짜
    'age',                -- 수신자가 X세 될 때
    'event',              -- 특정 이벤트 발생 시
    'after_death',        -- 사후 (트리거 별도)
    'family_milestone'    -- 가족 기념일
  )),
  
  deliver_at TIMESTAMPTZ,
  deliver_trigger_data JSONB,           -- {age: 18, event: "결혼"}
  
  intent TEXT,                          -- love | apology | wisdom | blessing | confession
  
  source_fact_ids UUID[],
  status TEXT DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- HELPER FUNCTIONS (의미 검색)
-- =====================================================

-- 기억 사실 의미 검색
CREATE OR REPLACE FUNCTION search_memory_facts(
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  summary TEXT,
  era TEXT,
  themes TEXT[],
  year_approx INT,
  similarity FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT 
    id, summary, era, themes, year_approx,
    1 - (embedding <=> p_query_embedding) AS similarity
  FROM memory_facts
  WHERE user_id = p_user_id AND embedding IS NOT NULL
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;

-- 엔티티 의미 검색
CREATE OR REPLACE FUNCTION search_entities(
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_entity_type TEXT DEFAULT NULL,
  p_top_k INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  name TEXT,
  description TEXT,
  attributes JSONB,
  similarity FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT 
    id, entity_type, name, description, attributes,
    1 - (embedding <=> p_query_embedding) AS similarity
  FROM entities
  WHERE user_id = p_user_id 
    AND embedding IS NOT NULL
    AND (p_entity_type IS NULL OR entity_type = p_entity_type)
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;

-- 엔티티 이름 퍼지 검색 (trigram)
CREATE OR REPLACE FUNCTION find_entity_by_name(
  p_user_id UUID,
  p_name TEXT,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  name TEXT,
  similarity FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT 
    id, entity_type, name,
    similarity(name, p_name) AS similarity
  FROM entities
  WHERE user_id = p_user_id
    AND (p_entity_type IS NULL OR entity_type = p_entity_type)
    AND (name % p_name OR p_name = ANY(aliases))
  ORDER BY similarity DESC
  LIMIT 5;
$$;

-- 미해결 주제 조회 (우선순위 순)
CREATE OR REPLACE FUNCTION get_open_loops(
  p_user_id UUID,
  p_top_k INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  topic TEXT,
  type TEXT,
  priority FLOAT,
  attempts INT
) LANGUAGE sql STABLE AS $$
  SELECT id, topic, type, priority, attempts
  FROM open_loops
  WHERE user_id = p_user_id 
    AND status = 'pending'
    AND (last_attempted_at IS NULL 
         OR last_attempted_at < now() - (retry_after_days || ' days')::interval)
  ORDER BY priority DESC, attempts ASC
  LIMIT p_top_k;
$$;

-- =====================================================
-- TRIGGERS (updated_at 자동 갱신)
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER entities_updated_at BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER facts_updated_at BEFORE UPDATE ON memory_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contents_updated_at BEFORE UPDATE ON generated_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER persona_updated_at BEFORE UPDATE ON persona_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- STORAGE BUCKETS (수동 생성 안내)
-- =====================================================
-- Supabase 대시보드 → Storage → New bucket
--   이름: audio-raw       (private, 음성 원본)
--   이름: audio-generated (private, TTS 편지)
--   이름: images          (public, 공유 카드용)

-- =====================================================
-- 확인 쿼리
-- =====================================================
SELECT 
  '✓ MOT 스키마 설치 완료.' AS status,
  COUNT(*)::TEXT || '개 테이블 생성됨.' AS tables_info
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';