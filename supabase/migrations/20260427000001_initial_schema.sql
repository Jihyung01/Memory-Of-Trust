-- ============================================
-- MOT Database Schema v1
-- Master Document v3 §6
--
-- Apply order:
--   1) this file (initial schema)
--   2) 20260427000002_rls_policies.sql
--   3) seed.sql (optional, for dev)
-- ============================================

-- ============================================
-- 사용자 / 가족
-- ============================================

-- 어르신 (사용자)
CREATE TABLE IF NOT EXISTS elders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT,                    -- "아버님", "어머님", "할머님"
  birth_year INT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  region TEXT,                          -- 사투리 힌트용
  voice_persona TEXT DEFAULT '손주 같은 작가',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 자녀/가족 (auth.users와 연결)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  is_payer BOOLEAN DEFAULT FALSE,
  can_view_outputs BOOLEAN DEFAULT TRUE,
  notification_kakao BOOLEAN DEFAULT TRUE,
  notification_email BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 디바이스
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  device_token TEXT UNIQUE NOT NULL,
  model TEXT,
  last_active_at TIMESTAMPTZ,
  schedule_morning TIME DEFAULT '10:30',
  schedule_afternoon TIME DEFAULT '15:00',
  schedule_evening TIME DEFAULT '19:00',
  ambient_start TIME DEFAULT '22:00',
  ambient_end TIME DEFAULT '07:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 사진 / 트리거
-- ============================================

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES family_members(id),
  storage_path TEXT NOT NULL,
  caption TEXT,
  approximate_year INT,
  approximate_age INT,
  people_in_photo TEXT[],
  location TEXT,
  shown_count INT DEFAULT 0,
  last_shown_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 가족이 입력한 질문 (F5 — MOT 결정적 차별점)
CREATE TABLE IF NOT EXISTS family_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  asked_by UUID REFERENCES family_members(id),
  raw_question TEXT NOT NULL,
  softened_question TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'asked', 'answered', 'skipped')),
  asked_at TIMESTAMPTZ,
  answered_in_utterance UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 시스템이 던진 프롬프트
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN (
    'photo_trigger', 'family_question', 'follow_up', 'open_check_in', 'sensory'
  )),
  prompt_text TEXT NOT NULL,
  source_photo_id UUID REFERENCES photos(id),
  source_family_question_id UUID REFERENCES family_questions(id),
  source_utterance_id UUID,
  scheduled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  was_answered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 원본 발화 (Immutable, append-only)
-- ============================================

CREATE TABLE IF NOT EXISTS raw_utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id),
  source_photo_id UUID REFERENCES photos(id),

  audio_url TEXT,
  audio_duration_sec NUMERIC,
  transcript TEXT NOT NULL,
  transcript_confidence NUMERIC,

  emotion_hint TEXT,
  has_silence_pauses BOOLEAN DEFAULT FALSE,
  noise_level TEXT,

  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 원본 발화 immutability 강제
CREATE OR REPLACE FUNCTION prevent_raw_utterance_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'raw_utterances is immutable (UPDATE/DELETE blocked by trigger)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS raw_utterance_no_update ON raw_utterances;
CREATE TRIGGER raw_utterance_no_update
BEFORE UPDATE OR DELETE ON raw_utterances
FOR EACH ROW EXECUTE FUNCTION prevent_raw_utterance_modification();

-- ============================================
-- 8축 누적 데이터
-- ============================================

-- when 축
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  approximate_year INT,
  approximate_age INT,
  description TEXT,
  source_utterance_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- who 축
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT,
  emotional_tone TEXT,
  mention_count INT DEFAULT 1,
  source_utterance_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- what 축
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  weight NUMERIC DEFAULT 1.0,
  source_utterance_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- how 축
CREATE TABLE IF NOT EXISTS emotion_layer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  emotion TEXT,
  intensity INT CHECK (intensity BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- unresolved 축 (MOT 정서적 핵심)
CREATE TABLE IF NOT EXISTS unresolved_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  type TEXT CHECK (type IN ('apology', 'gratitude', 'regret', 'wish', 'unsaid')),
  toward_entity_id UUID REFERENCES entities(id),
  excerpt TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'expressed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- sensory 축
CREATE TABLE IF NOT EXISTS sensory_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  sense TEXT CHECK (sense IN ('smell', 'sight', 'sound', 'touch', 'taste')),
  detail TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- verified 축 (원본 수정 X, 별도 표시)
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  verified_by UUID REFERENCES family_members(id),
  verification_status TEXT CHECK (verification_status IN ('confirmed', 'corrected', 'augmented')),
  family_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 후보 / 산출물
-- ============================================

CREATE TABLE IF NOT EXISTS memory_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  fact TEXT NOT NULL,
  confidence NUMERIC,
  needs_family_check BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'promoted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL CHECK (output_type IN (
    'weekly_card', 'monthly_chapter', 'annual_book',
    'letter_to_person', 'future_letter', 'unresolved_book',
    'values_book', 'memorial_video_script'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  delivered_to UUID[],
  delivered_at TIMESTAMPTZ,
  source_utterance_ids UUID[],
  source_timeline_event_ids UUID[],
  generated_by_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 결제 / 구독
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  payer_family_id UUID REFERENCES family_members(id),
  plan TEXT NOT NULL CHECK (plan IN ('pilot', 'beta', 'premium')),
  monthly_price_krw INT NOT NULL,
  device_handling TEXT CHECK (device_handling IN ('deposit', 'rental', 'family_owned')),
  deposit_krw INT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_utterances_elder_time ON raw_utterances(elder_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_elder ON photos(elder_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_family_questions_pending ON family_questions(elder_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_prompts_scheduled ON prompts(elder_id, scheduled_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outputs_delivery ON story_outputs(elder_id, output_type, delivered_at);
CREATE INDEX IF NOT EXISTS idx_emotion_layer_utterance ON emotion_layer(utterance_id);
CREATE INDEX IF NOT EXISTS idx_unresolved_open ON unresolved_queue(elder_id, status) WHERE status = 'open';

-- ============================================
-- updated_at 자동 갱신 트리거 (elders, timeline_events 등)
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_elders_updated_at ON elders;
CREATE TRIGGER trg_elders_updated_at
BEFORE UPDATE ON elders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_timeline_events_updated_at ON timeline_events;
CREATE TRIGGER trg_timeline_events_updated_at
BEFORE UPDATE ON timeline_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
