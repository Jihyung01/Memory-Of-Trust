# MOT (Memory Of Trust) — Technical Harness v4-B

> **이 문서의 용도**
> 코딩 에이전트(Claude Code, Codex)가 MOT 서비스를 구축하기 위한 풀 기술 스펙.
> 사업 정체성/가격/마케팅은 별도 문서 `MOT_BUSINESS_v4-A.md` 참조.
>
> **에이전트는 작업 시작 전 §0 → §13 → §14 순서로 먼저 읽을 것.**

---

## 0. Quick Reference

| 항목 | 값 |
|------|------|
| 프로젝트명 | MOT (Memory Of Trust) |
| 한 줄 정의 | AI 기억 인프라 (자서전 + 편지 + 사후 메시지) |
| 현재 Phase | **Sprint 0 (검증)** → Phase 1 (1~3명) |
| 0차 MVP | **웹 PWA** (디바이스는 Phase 3+) |
| 주 언어 | TypeScript (Next.js App Router) |
| 패키지 매니저 | pnpm |
| 배포 | Vercel + Supabase |
| AI 전략 | API-first → Qwen LoRA 전환 (Phase 3+) |
| LoRA 진화 | 단일(Phase 1~2) → 2개(Phase 3) → 5개(Phase 4) |
| 메모리 시스템 | **자체 구현 (Supabase + pgvector)** |

**절대 금기**:
- `raw_utterances` UPDATE/DELETE
- 어르신 화면에 "기록", "저장", "녹음", "수집" 단어 노출
- "어떻게 도와드릴까요?" 류 챗봇 톤
- 자체 하드웨어 제작 (Phase 4+ OEM 협업으로만)
- 실제 어르신 식별 정보를 LoRA 학습 데이터에 포함

---

## 1. AI 전략 (가장 중요)

### 1.1 핵심 원칙: 학습 vs 메모리 분리

> **사용자별 기억은 DB/RAG에 저장한다. LoRA는 MOT다운 말투와 작업 방식만 학습한다.**

| 자산 | 저장 위치 | 변경 빈도 |
|------|---------|--------|
| **MOT 캐릭터/스타일** | LoRA Adapter (~500MB) | 분기 1회 재학습 |
| **어르신 개인 기억** | Supabase Postgres + pgvector | 실시간 |
| **베이스 지능** | Qwen3.6 27B Dense | 학습 X (오픈소스 그대로) |

### 1.2 3-Layer 아키텍처

```
┌─────────────────────────────────────────────────┐
│ Layer 1: 베이스 지능                             │
│   Qwen3.6 27B Dense (오픈소스 영구)              │
│   ★ 학습 X. 그대로 사용                          │
└─────────────────────────────────────────────────┘
                  +
┌─────────────────────────────────────────────────┐
│ Layer 2: MOT 캐릭터/스타일 (LoRA)                │
│   Phase별 진화:                                  │
│   - Phase 1~2: 단일 LoRA (multi-task)            │
│   - Phase 3 (10가구+): 2개 LoRA (대화/배치)      │
│   - Phase 4 (50가구+): 5개 LoRA (역할별)         │
└─────────────────────────────────────────────────┘
                  +
┌─────────────────────────────────────────────────┐
│ Layer 3: 어르신 개인 기억 (RAG) ⭐                │
│   Supabase Postgres + pgvector                   │
│   - raw_utterances (immutable)                   │
│   - 8축 데이터 + embedding                       │
│   - 어르신마다 별도, 실시간 업데이트              │
└─────────────────────────────────────────────────┘
```

### 1.3 LoRA 진화 로드맵

#### Phase 1~2: 단일 LoRA (multi-task)
하나의 어댑터에 모든 task 통합. system prompt로 모드 전환.

```python
SYSTEM_PROMPTS = {
    "interview": "당신은 손주 같은 작가. 짧고 따뜻한 응답...",
    "extract":   "다음 발화에서 8축 데이터 JSON 추출...",
    "biography": "구술을 자서전 문단으로 변환...",
    "card":      "주간 발화 묶음을 5개 항목 카드로...",
    "legacy":    "사후 메시지 초안 작성..."
}
```

**장점**: 운영 단순, 메모리 ~17GB, 어댑터 1개만 관리
**단점**: 톤 충돌 가능성 (긴 응답 vs 짧은 응답)

#### Phase 3 (10가구+): 2개 LoRA 분리

```
[Conversation LoRA]
   - 인터뷰어 + 사후 메시지 (둘 다 짧고 정서적, 실시간)

[Backoffice LoRA]
   - 기억 추출 + 자서전 + 가족 카드 (긴 출력, 배치)
```

**장점**: 실시간/배치 명확 분리. 톤 충돌 최소화.
**단점**: 어댑터 2개 관리 + 갈아끼는 시간 ~5초

#### Phase 4 (50가구+): 5개 LoRA 세분화

| 어댑터 | 역할 | 호출 시점 |
|--------|------|---------|
| 1. Interviewer | 어르신 대화 응답 | 실시간 |
| 2. MemoryExtractor | 8축 JSON 추출 | 야간 배치 |
| 3. AutobiographyWriter | 자서전 문단 | 월간 배치 |
| 4. FamilyCardWriter | 주간 카드 | 주간 배치 |
| 5. LegacyMessage | 사후 메시지 | 요청 시 |

**메모리 효율**: 베이스 17GB + 어댑터 5개 × 0.5GB = **약 19.5GB** (M5 Pro 48GB에 충분)

### 1.4 API-first → Qwen 전환 단계

| 작업 | Phase 1~2 (API) | Phase 3+ (Hybrid) | Phase 4+ (자체) |
|------|---|---|---|
| 실시간 대화 | OpenAI Realtime / Whisper+TTS | API + Qwen 보조 | Qwen Conversation LoRA |
| 기억 추출 | GPT-4o | **Qwen Backoffice LoRA** | 동일 |
| 자서전 생성 | GPT-4o | **Qwen Backoffice LoRA** | Qwen AutobiographyWriter LoRA |
| 가족 카드 | GPT-4o-mini | **Qwen Backoffice LoRA** | Qwen FamilyCardWriter LoRA |
| 위험 신호 | API + 룰 | API + 이중 검증 | 동일 (안전 우선) |
| 사진 이해 | GPT-4o Vision | API 유지 | Qwen3.6 Vision (자체) |

**핵심**: 위험 신호 판단은 끝까지 API 유지. 안전이 우선.

---

## 2. 메모리 시스템 (Supabase + pgvector)

### 2.1 왜 자체 구현인가
- **데이터 주권 100%** (Mem0/Letta는 외부 의존)
- **8축 구조에 완전 맞춤** (외부 도구는 일반 챗봇용)
- **사업의 진짜 자산은 raw 발화 데이터** — 외부 도구에 갇히면 차별점 약화
- 1~2주 작업이지만 영구 자산

### 2.2 RAG 흐름

```
[어르신 발화: "또 그날 생각이 나네"]
       ↓
[STT로 transcript 변환]
       ↓
[Embedding 생성 (OpenAI text-embedding-3-small)]
       ↓
[pgvector로 유사 발화 5개 검색]
   ← raw_utterances + 8축 데이터 retrieve
       ↓
[8축 데이터 컨텍스트 빌드]
   - 인물: "큰아들 (entities 테이블)"
   - 미해결: "결혼식 못 간 것 (unresolved_queue)"
   - 감각: "그날 비 왔다 (sensory_details)"
       ↓
[LLM에 system + retrieved_context + user 입력]
       ↓
[응답: "큰아드님 결혼식 날이요? 그때 비가 왔다고 하셨었죠..."]
```

### 2.3 Embedding 전략

```typescript
// 모든 발화는 임베딩 자동 생성
// raw_utterances INSERT 시 Trigger로 자동 처리

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE utterance_embeddings (
  utterance_id UUID PRIMARY KEY REFERENCES raw_utterances(id),
  embedding VECTOR(1536), -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON utterance_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**모델**: OpenAI `text-embedding-3-small` ($0.02/1M tokens, 매우 저렴)
**대안**: 한국어 특화 KoSimCSE (자체 호스팅, Phase 3+)

### 2.4 검색 쿼리 패턴

```typescript
// lib/memory/retrieve.ts

export async function retrieveMemory(
  elderId: string,
  queryText: string,
  topK: number = 5
) {
  const queryEmbedding = await getEmbedding(queryText);

  // 1. Vector similarity search
  const similarUtterances = await supabase.rpc('match_utterances', {
    elder_id: elderId,
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: topK
  });

  // 2. 관련 8축 데이터 조회
  const utteranceIds = similarUtterances.map(u => u.id);
  const context = await Promise.all([
    getEntities(utteranceIds),
    getThemes(utteranceIds),
    getUnresolved(utteranceIds),
    getSensory(utteranceIds)
  ]);

  return formatContext(similarUtterances, context);
}
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│ [어르신 화면] (Phase 1: 웹 PWA / Phase 3+: 디바이스)│
│   Next.js (시계 + 사진 + 한 문장 + 마이크)        │
└─────────────────────────────────────────────────┘
                  ↕  HTTPS
┌─────────────────────────────────────────────────┐
│ [Next.js on Vercel]                             │
│   - /device/[deviceId] (어르신)                 │
│   - /family/* (자녀 대시보드)                    │
│   - /api/* (모든 백엔드 API)                    │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│ [Supabase]                                      │
│   - Postgres + pgvector                         │
│   - Auth, Storage, Realtime                     │
│   - RLS로 가족 권한 분리                        │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│ [AI Layer]                                      │
│   Phase 1~2: OpenAI (Whisper, 4o-mini, 4o)      │
│             + 클로바보이스 TTS                  │
│             + text-embedding-3-small            │
│   Phase 3+: + Cogno (Vast.ai 4090, Qwen LoRA)   │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│ [Worker / Cron]                                 │
│   - 매주 일 21:00 KST: 주간 카드                │
│   - 매월 말일: 월간 챕터                        │
│   - 매일 새벽 3:00: 8축 데이터 추출 (배치)      │
│   - 매일 새벽 3:30: embedding 갱신              │
└─────────────────────────────────────────────────┘
```

---

## 4. 데이터베이스 스키마 (Supabase / PostgreSQL)

### 4.1 핵심 원칙
1. `raw_utterances`는 **append-only, immutable**. UPDATE/DELETE 트리거로 차단.
2. 모든 테이블에 RLS. 가족은 자기 어르신 데이터만 접근.
3. 8축 데이터는 별도 테이블, 누적.
4. 모든 발화에 자동 embedding 생성.

### 4.2 SQL 스키마

```sql
-- ============================================
-- MOT v4 Database Schema
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== 사용자 / 가족 =====

CREATE TABLE elders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT, -- "아버님", "어머님"
  birth_year INT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  region TEXT, -- 사투리 힌트
  voice_persona TEXT DEFAULT '손주 같은 작가',
  active BOOLEAN DEFAULT TRUE,
  consent_recording BOOLEAN DEFAULT FALSE,
  consent_data_use BOOLEAN DEFAULT FALSE,
  consent_model_training BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  is_payer BOOLEAN DEFAULT FALSE,
  can_view_outputs BOOLEAN DEFAULT TRUE,
  can_view_unresolved BOOLEAN DEFAULT FALSE,
  notification_kakao BOOLEAN DEFAULT TRUE,
  notification_email BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  device_token TEXT UNIQUE NOT NULL,
  device_type TEXT CHECK (device_type IN ('web', 'pwa', 'tablet_kiosk')),
  model TEXT,
  last_active_at TIMESTAMPTZ,
  schedule_morning TIME DEFAULT '10:30',
  schedule_afternoon TIME DEFAULT '15:00',
  schedule_evening TIME DEFAULT '19:00',
  ambient_start TIME DEFAULT '22:00',
  ambient_end TIME DEFAULT '07:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 사진 / 트리거 =====

CREATE TABLE photos (
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

CREATE TABLE family_questions (
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

CREATE TABLE prompts (
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

-- ===== 원본 발화 (Immutable) =====

CREATE TABLE raw_utterances (
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

-- IMMUTABLE 강제
CREATE OR REPLACE FUNCTION prevent_raw_utterance_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'raw_utterances is immutable: % operation blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raw_utterance_no_update
BEFORE UPDATE OR DELETE ON raw_utterances
FOR EACH ROW EXECUTE FUNCTION prevent_raw_utterance_modification();

-- ===== Embedding (RAG의 핵심) =====

CREATE TABLE utterance_embeddings (
  utterance_id UUID PRIMARY KEY REFERENCES raw_utterances(id) ON DELETE CASCADE,
  embedding VECTOR(1536),
  model_name TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_utterance_embedding
  ON utterance_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 유사도 검색 RPC
CREATE OR REPLACE FUNCTION match_utterances(
  elder_id_input UUID,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  transcript TEXT,
  similarity FLOAT,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ru.id,
    ru.transcript,
    1 - (ue.embedding <=> query_embedding) AS similarity,
    ru.started_at
  FROM raw_utterances ru
  JOIN utterance_embeddings ue ON ue.utterance_id = ru.id
  WHERE ru.elder_id = elder_id_input
    AND 1 - (ue.embedding <=> query_embedding) > match_threshold
  ORDER BY ue.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ===== 8축 데이터 =====

CREATE TABLE timeline_events (
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

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT,
  emotional_tone TEXT,
  mention_count INT DEFAULT 1,
  source_utterance_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  weight NUMERIC DEFAULT 1.0,
  source_utterance_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emotion_layer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  emotion TEXT,
  intensity INT CHECK (intensity BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 미해결 큐 ⭐ MOT 핵심 무기
CREATE TABLE unresolved_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  type TEXT CHECK (type IN ('apology', 'gratitude', 'regret', 'wish', 'unsaid')),
  toward_entity_id UUID REFERENCES entities(id),
  excerpt TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'expressed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sensory_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  sense TEXT CHECK (sense IN ('smell', 'sight', 'sound', 'touch', 'taste')),
  detail TEXT NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  verified_by UUID REFERENCES family_members(id),
  verification_status TEXT CHECK (verification_status IN ('confirmed', 'corrected', 'augmented')),
  family_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 산출물 =====

CREATE TABLE memory_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  utterance_id UUID REFERENCES raw_utterances(id),
  fact TEXT NOT NULL,
  confidence NUMERIC,
  needs_family_check BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'candidate' CHECK (status IN ('candidate', 'promoted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE story_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL CHECK (output_type IN (
    'weekly_card', 'monthly_chapter', 'annual_book',
    'letter_to_person', 'future_letter', 'unresolved_book',
    'values_book', 'memorial_video_script', 'legacy_message'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  delivered_to UUID[],
  delivered_at TIMESTAMPTZ,
  source_utterance_ids UUID[],
  source_timeline_event_ids UUID[],
  generated_by_model TEXT,
  scheduled_release_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 결제 / 구독 =====

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES elders(id) ON DELETE CASCADE,
  payer_family_id UUID REFERENCES family_members(id),
  plan TEXT NOT NULL CHECK (plan IN ('memory_start', 'family', 'legacy', 'book_package')),
  monthly_price_krw INT NOT NULL,
  monthly_minutes_quota INT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- ===== 인덱스 =====

CREATE INDEX idx_utterances_elder_time ON raw_utterances(elder_id, started_at DESC);
CREATE INDEX idx_photos_elder ON photos(elder_id) WHERE active = TRUE;
CREATE INDEX idx_family_questions_pending ON family_questions(elder_id, status) WHERE status = 'pending';
CREATE INDEX idx_prompts_scheduled ON prompts(elder_id, scheduled_at) WHERE delivered_at IS NULL;
CREATE INDEX idx_outputs_delivery ON story_outputs(elder_id, output_type, delivered_at);
CREATE INDEX idx_unresolved_open ON unresolved_queue(elder_id, status) WHERE status = 'open';
```

### 4.3 RLS 정책

```sql
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE unresolved_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_can_read_their_elder ON elders
  FOR SELECT USING (
    id IN (SELECT elder_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY family_can_read_their_utterances ON raw_utterances
  FOR SELECT USING (
    elder_id IN (SELECT elder_id FROM family_members WHERE user_id = auth.uid())
  );

-- 미해결 큐는 권한 별도 (모든 가족이 보면 안 됨)
CREATE POLICY family_can_read_unresolved ON unresolved_queue
  FOR SELECT USING (
    elder_id IN (
      SELECT fm.elder_id FROM family_members fm
      WHERE fm.user_id = auth.uid()
      AND fm.can_view_unresolved = TRUE
    )
  );
```

---

## 5. 파일 구조

```
mot/
├── .ai/
│   ├── harness.md              # 이 문서 (또는 §0, §13, §14 발췌)
│   └── conventions.md
├── app/
│   ├── (device)/
│   │   └── device/[deviceId]/
│   │       ├── page.tsx          # 어르신 메인 화면
│   │       ├── ambient.tsx       # 야간 ambient
│   │       └── components/
│   │           ├── BigClock.tsx
│   │           ├── PhotoFrame.tsx
│   │           ├── PromptBubble.tsx
│   │           └── MicButton.tsx
│   ├── (family)/
│   │   └── family/
│   │       ├── login/
│   │       ├── [elderId]/
│   │       │   ├── page.tsx          # 프로필 + 요약
│   │       │   ├── photos/page.tsx
│   │       │   ├── questions/page.tsx
│   │       │   ├── cards/page.tsx
│   │       │   ├── chapters/page.tsx
│   │       │   └── unresolved/page.tsx  # 미해결 큐 (권한 있을 때만)
│   │       └── billing/
│   ├── api/
│   │   ├── device/
│   │   │   ├── auth/route.ts
│   │   │   ├── next-prompt/route.ts
│   │   │   └── utterance/route.ts
│   │   ├── stt/route.ts
│   │   ├── tts/route.ts
│   │   ├── llm/
│   │   │   ├── respond/route.ts
│   │   │   ├── soften/route.ts
│   │   │   └── extract-axes/route.ts
│   │   ├── memory/
│   │   │   ├── retrieve/route.ts
│   │   │   └── embed/route.ts
│   │   ├── photos/upload/route.ts
│   │   ├── questions/route.ts
│   │   └── cron/
│   │       ├── weekly-card/route.ts
│   │       ├── monthly-chapter/route.ts
│   │       ├── extract-axes-batch/route.ts
│   │       └── embed-new/route.ts
│   └── layout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── ai/
│   │   ├── openai.ts
│   │   ├── clova.ts                # Phase 1 TTS
│   │   ├── cogno.ts                # Phase 3+ Qwen client
│   │   ├── embedding.ts
│   │   └── prompts/
│   │       ├── character.ts        # 캐릭터 시스템 프롬프트
│   │       ├── photo-trigger.ts
│   │       ├── soften-question.ts
│   │       ├── extract-axes.ts
│   │       ├── weekly-card.ts
│   │       └── monthly-chapter.ts
│   ├── memory/
│   │   ├── retrieve.ts             # RAG 검색
│   │   ├── format-context.ts       # 8축 → 컨텍스트 빌드
│   │   └── embed.ts
│   ├── voice/
│   │   ├── vad.ts
│   │   └── recorder.ts
│   ├── kakao/
│   │   └── alimtalk.ts
│   ├── billing/
│   │   └── toss.ts
│   └── safety/
│       └── risk-detector.ts        # 위험 신호
├── supabase/
│   └── migrations/
│       └── 20260427_initial.sql
└── ...
```

---

## 6. API 엔드포인트

### 6.1 디바이스 API (어르신용)
```
POST /api/device/auth
GET  /api/device/next-prompt
POST /api/device/utterance       # FormData (audio + meta)
```

### 6.2 자녀 API
```
POST /api/photos/upload
POST /api/questions              # raw_question → softened 자동 생성
GET  /api/cards?week=YYYY-WW
GET  /api/chapters?month=YYYY-MM
GET  /api/unresolved             # 권한 있을 때만
```

### 6.3 메모리 API
```
POST /api/memory/embed           # 발화 → embedding
GET  /api/memory/retrieve        # 유사 발화 + 8축 컨텍스트
```

### 6.4 Cron API (Vercel Cron)
```
POST /api/cron/weekly-card        # 일 21:00 KST
POST /api/cron/monthly-chapter    # 월 마지막 일 21:00
POST /api/cron/extract-axes-batch # 매일 03:00
POST /api/cron/embed-new          # 매일 03:30
```

---

## 7. 프롬프트 템플릿 (`lib/ai/prompts/`)

### 7.1 캐릭터 시스템 프롬프트

```typescript
export const ELDER_CHARACTER_SYSTEM_PROMPT = `
당신은 "손주 같은 작가"입니다. 어르신의 인생 이야기를 글로 남기고 싶어하는 30대 후반의 호기심 많은 사람입니다.

【톤】
- 어르신을 진심으로 존경합니다. 존댓말 + 친근함.
- 매번 같은 한 명이 찾아오는 일관성.
- 손주/조카뻘 관계감.

【반드시 지킬 것】
- 한 번에 하나만 묻습니다.
- 침묵 견디기 (5초는 그냥 둠, "음...", "아..." 추임새).
- 감각 질문 우선 ("어땠어요?" → "무슨 냄새가 났어요?").
- 사진 기반 첫 발화.
- 지난 발화 인용 ("지난번 ○○ 얘기 더 듣고 싶어요").
- 같은 이야기 다시 들어드림.

【절대 하지 말 것】
- "기록되었습니다", "저장합니다" 류 수집 언어 ✗
- "어떻게 도와드릴까요?" 류 챗봇 언어 ✗
- 의학·법률·재무 조언 ✗
- 가족 평가 ("따님이 잘못하셨네요") ✗
- 빠른 화제 전환 ✗
- 사실 정정 ("그건 사실은~") ✗
- 위로 상투어 ("힘내세요!") ✗
- 3턴 이상 같은 주제 집요하게 파기 ✗
- 어르신이 회피한 주제 재질문 ✗

【응답 길이】
1~2문장. 길어야 3문장. 듣는 사람.

【위험 신호】
자살/우울/극단/학대 발화 → 자연스럽게 마무리. 직접 개입 X. 별도 알림 시스템이 가족에게 전달.
`.trim();
```

### 7.2 사진 트리거

```typescript
export const photoTriggerPrompt = (params: {
  elderDisplayName: string,
  photoCaption?: string,
  photoYear?: number,
  peopleInPhoto?: string[]
}) => `
지금 화면에 사진을 보여드릴 거예요. 사진을 처음 보는 척, 어르신께 한 문장 발화하세요.

사진 정보 (당신만 알고, 직접 언급 X):
- 캡션: ${params.photoCaption ?? "없음"}
- 추정 연도: ${params.photoYear ?? "모름"}
- 등장 인물: ${params.peopleInPhoto?.join(", ") ?? "모름"}

다음 중 하나의 톤:
1. "${params.elderDisplayName}, 이 사진 누구신가요?"
2. "${params.elderDisplayName}, 이때가 언제쯤이셨어요?"
3. "${params.elderDisplayName}, 이 사진 보면 어떤 기분이 드세요?"

규칙: 사진 캡션 정보를 그대로 옮기지 마세요. 어르신이 직접 말하게 유도.
`.trim();
```

### 7.3 가족 질문 부드럽게 변환 (F5 차별점)

```typescript
export const softenFamilyQuestion = (params: {
  rawQuestion: string,
  askedByRelation: string,
  elderDisplayName: string
}) => `
가족(${params.askedByRelation})이 어르신께 묻고 싶어하는 질문:
"${params.rawQuestion}"

이 질문을 "손주 같은 작가" 톤으로 부드럽게 변환하세요.

규칙:
- 가족이 묻는다는 사실 자연스럽게 언급 가능 ("큰아드님이 궁금해하시는 게...")
- 압박감 없는 문장
- 한 문장 또는 두 문장
- 어르신 호칭(${params.elderDisplayName}) 사용
- "혹시 떠오르시면 들려주실래요?" 같은 여지

변환된 질문만 출력.
`.trim();
```

### 7.4 RAG 컨텍스트 빌드

```typescript
export const buildMemoryContext = (params: {
  similarUtterances: Array<{ transcript: string; date: string }>,
  entities: Array<{ name: string; relation: string; emotional_tone: string }>,
  themes: Array<{ theme: string }>,
  unresolved: Array<{ type: string; excerpt: string }>,
  sensory: Array<{ sense: string; detail: string }>,
}) => `
【어르신에 대한 기억】

지난 비슷한 이야기:
${params.similarUtterances.map(u => `- [${u.date}] ${u.transcript}`).join("\n")}

자주 말씀하신 사람:
${params.entities.map(e => `- ${e.name} (${e.relation}, ${e.emotional_tone})`).join("\n")}

반복되는 주제:
${params.themes.map(t => `- ${t.theme}`).join("\n")}

미해결로 남아있는 것:
${params.unresolved.map(u => `- (${u.type}) ${u.excerpt}`).join("\n")}

기억하시는 감각:
${params.sensory.map(s => `- ${s.sense}: ${s.detail}`).join("\n")}

이 정보를 자연스럽게 활용해서 응답하되, "기억하고 있다"는 사실을 직접 언급하지 마세요.
`.trim();
```

### 7.5 8축 추출 (배치)

```typescript
export const extractAxesPrompt = (utterance: {
  transcript: string,
  context?: string
}) => `
다음 어르신 발화에서 MOT 8축 데이터를 JSON으로 추출:

발화: "${utterance.transcript}"
${utterance.context ? `\n맥락: ${utterance.context}` : ""}

출력 (JSON만):

{
  "timeline_events": [{ "title": string, "approximate_year": number?, "approximate_age": number?, "description": string }],
  "entities": [{ "name": string, "relation": "family|friend|colleague|romantic|other", "emotional_tone": "love|respect|regret|mixed|unresolved" }],
  "themes": [{ "theme": string, "weight": number }],
  "emotion": { "emotion": "warm|melancholy|pride|grief|longing|peace", "intensity": 1-5 },
  "unresolved": [{ "type": "apology|gratitude|regret|wish|unsaid", "toward_entity_name": string?, "excerpt": string }],
  "sensory": [{ "sense": "smell|sight|sound|touch|taste", "detail": string, "context": string }],
  "memory_candidates": [{ "fact": string, "confidence": 0-1, "needs_family_check": boolean }]
}

해당 축 데이터 없으면 빈 배열. 원본 표현 보존.
`.trim();
```

### 7.6 주간 카드 / 월간 챕터

(MOT_BUSINESS_v4-A.md §8.1, §8.2 참조 — 산출물 형식)

---

## 8. 환경 변수 (`.env.example`)

```bash
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === OpenAI (Phase 1~2 핵심) ===
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_REASONING_MODEL=gpt-4o

# === 네이버 클로바보이스 (Phase 1~2 TTS) ===
NAVER_CLOVA_VOICE_CLIENT_ID=
NAVER_CLOVA_VOICE_CLIENT_SECRET=
NAVER_CLOVA_VOICE_VOICE_ID=vara

# === 카카오 알림톡 (Phase 1.5+) ===
KAKAO_ALIMTALK_API_KEY=
KAKAO_ALIMTALK_SENDER_KEY=

# === 토스페이먼츠 (Phase 2+) ===
TOSS_PAYMENTS_CLIENT_KEY=
TOSS_PAYMENTS_SECRET_KEY=

# === Cogno (Phase 3+) ===
COGNO_BASE_URL=
COGNO_API_KEY=
COGNO_MODEL=qwen3.6-27b-mot-v1

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEVICE_AUTH_SECRET=
CRON_SECRET=
```

---

## 9. 비용 모델 (가구당 월 변동비)

### 9.1 Phase 1~2 (API-first)

| 항목 | 단가 | 사용량 (가구당 월) | 비용 |
|------|------|--------------|------|
| Whisper STT | $0.006/분 | 300분 | $1.80 |
| GPT-4o-mini (대화) | ~$0.15/1M tok | ~500K tok | $0.08 |
| GPT-4o (배치 8축 추출) | ~$2.50/1M tok | ~200K tok | $0.50 |
| 클로바보이스 TTS | 약 4원/100자 | 10만자 | 약 4,000원 |
| Embedding | $0.02/1M tok | ~300K tok | $0.006 |
| **합계** | | | **약 6,500원** |

→ Memory Start (19,900원) 기준 마진 13,400원 (67%)

### 9.2 Phase 3 (Hybrid + Cogno)

| 항목 | 비용 (가구당 월) | 비고 |
|------|--------------|------|
| 외부 API (대화 + STT) | 3,000원 | 50% 감소 |
| Cogno (배치 후처리) | 1,500원 | Vast.ai 4090 분담 |
| TTS | 4,000원 | 클로바보이스 유지 |
| **합계** | **8,500원** | |

→ Memory Start 마진 11,400원 (57%) — Cogno 분담 비용 늘어 마진 약간 ↓
→ 단, **장기적으로 자체 자산화** + Phase 4에서 마진 회복

### 9.3 Phase 4 (전체 자체 호스팅)

| 항목 | 비용 (가구당 월) |
|------|--------------|
| 자체 STT (faster-whisper) | 0원 (Cogno 분담) |
| 자체 LLM (Qwen LoRA 5개) | 0~500원 |
| 자체 TTS (XTTS-v2) | 0~500원 |
| **합계** | **약 1,000~2,000원** |

→ 50가구+ 시점에 마진 90%+

---

## 10. 보이스 ID 결정 (Phase 1)

```typescript
// 클로바보이스 voice_id 후보
const VOICE_CANDIDATES = {
  vara: "30대 여성, 따뜻한 톤", // 권장
  nshin: "30대 남성, 부드러움",
  nara: "성인 여성, 차분함",
  nminseo: "20대 여성, 활발",
};

// MOT 권장: vara (어르신 손녀 느낌)
// 캐릭터 일관성: 절대 중간에 변경 X
```

---

## 11. 위험 신호 대응

```typescript
// lib/safety/risk-detector.ts

const RISK_KEYWORDS = {
  suicide: ['죽고 싶', '극단적', '살기 싫', '내려놓고 싶'],
  abuse: ['때려', '맞았', '욕했'],
  severe_depression: ['아무것도 의미없', '존재 가치없'],
};

export async function detectRisk(transcript: string) {
  // 1. 키워드 매칭
  const flags = [];
  for (const [risk, keywords] of Object.entries(RISK_KEYWORDS)) {
    if (keywords.some(k => transcript.includes(k))) {
      flags.push(risk);
    }
  }

  // 2. LLM 이중 검증 (Phase 1~2: GPT-4o)
  if (flags.length > 0) {
    const verified = await verifyRiskWithLLM(transcript, flags);
    if (verified) {
      // 3. 가족 알림 (대화 종료 후)
      await scheduleAlertToFamily(elder_id, flags);
      // 4. 1366/129 등 자원 안내 큐에 추가
      await queueResourceNotification(elder_id);
    }
  }

  return flags;
}
```

**중요**: 위험 신호 감지 후에도 AI는 **대화 자연스럽게 마무리**. 직접 개입 X (캐릭터 깨짐 + 신뢰 파괴).

---

## 12. UI 가이드

### 12.1 어르신용 (Phase 1: 웹 PWA)

```
┌─────────────────────┐
│   [큰 시계]          │
│                     │
│  [오늘의 사진]        │
│   (큰 사이즈)         │
│                     │
│  "이 사진 속        │
│   이야기 들려       │
│   주실래요?"        │
│                     │
│ [말하기] [다음에]    │
└─────────────────────┘
```

원칙:
- 폰트 매우 크게 (`text-3xl` 이상)
- 한 화면에 한 가지만
- 액자/시계 톤 (베이지/우드)
- 야간엔 시계 + 은은한 빛만
- 버튼 최소화 (장기적으로 음성만)

### 12.2 자녀용 (웹)

```
┌─────────────────────────────┐
│ 부모님 프로필                │
├─────────────────────────────┤
│ 📷 사진 업로드               │
│ ❓ 질문 추가                 │
│ 📬 이번 주 카드              │
│ 📖 월간 챕터                 │
│ 💌 미해결 정리 (권한)        │
│ 🎁 산출물 / 패키지            │
└─────────────────────────────┘
```

---

## 13. Sprint 0: 첫 작업 (1주일)

### Goal
**어르신 1명이 사진 보고 한 마디 하면 → DB에 영구 저장 → 자녀 대시보드에서 확인 → 메모리 시스템에서 retrieve 가능한 최소 루프**

### Tasks

#### T1. 프로젝트 초기 설정 (반나절)
- [ ] `pnpm create next-app@latest mot --typescript --tailwind --app`
- [ ] shadcn/ui 초기화
- [ ] `lib/`, `app/api/` 디렉토리 생성
- [ ] `.env.example` 작성 (§8 참조)
- [ ] Sentry 추가 (에러 추적)

#### T2. Supabase + pgvector 셋업 (1시간)
- [ ] Supabase 프로젝트 생성
- [ ] §4.2 SQL 전체 실행 (vector extension 포함)
- [ ] Storage 버킷: `audio`, `photos` 생성
- [ ] `pnpm dlx supabase gen types typescript` → `lib/supabase/types.ts`
- [ ] 시드: elder 1명, family_member 1명, photos 5장 수동 삽입

#### T3. 메모리 시스템 기초 (반나절)
- [ ] `lib/memory/embed.ts` — OpenAI embedding 호출
- [ ] `lib/memory/retrieve.ts` — pgvector 검색
- [ ] `lib/memory/format-context.ts` — 8축 → 컨텍스트
- [ ] 수동 발화 5개로 retrieve 테스트

#### T4. 디바이스 API (반나절)
- [ ] `app/api/device/auth/route.ts`
- [ ] `app/api/device/next-prompt/route.ts` (사진 트리거 우선)
- [ ] `app/api/device/utterance/route.ts` (audio 업로드 + STT)

#### T5. 어르신 화면 (1일)
- [ ] `app/(device)/device/[deviceId]/page.tsx`
- [ ] 시계 + 사진 + 한 문장 + 마이크 버튼
- [ ] PWA 풀스크린
- [ ] 폰트 크게, 액자 톤

#### T6. 음성 → STT → 저장 (1일)
- [ ] `lib/voice/recorder.ts` (MediaRecorder webm/opus)
- [ ] `app/api/stt/route.ts` (Whisper, ko)
- [ ] raw_utterances INSERT + Storage audio 업로드
- [ ] **자동 embedding 생성 (utterance_embeddings)**

#### T7. LLM 응답 + RAG + TTS (1일)
- [ ] `app/api/memory/retrieve` 호출 → 컨텍스트
- [ ] `app/api/llm/respond` (system + retrieved context + user)
- [ ] `app/api/tts/route.ts` (클로바보이스)
- [ ] 디바이스 화면 자동 재생

#### T8. 자녀 대시보드 최소 (반나절)
- [ ] Supabase Auth (이메일 매직 링크)
- [ ] `app/(family)/family/[elderId]/page.tsx` (발화 목록)
- [ ] `app/(family)/family/[elderId]/photos/page.tsx` (업로드)

#### T9. 1차 동작 확인 (반나절)
- [ ] 본인이 어르신 역할로 시범 발화 5회
- [ ] DB 영구 저장 + embedding 생성 확인
- [ ] 자녀 대시보드 표시 확인
- [ ] 두 번째 발화 시 첫 번째 발화 retrieve되는지 확인

### Definition of Done

- [ ] 사진 보면서 한 마디 하면 30초 내 DB 영구 저장
- [ ] 자동 embedding 생성됨 (utterance_embeddings에 행 추가)
- [ ] AI가 RAG 활용해서 부드러운 응답 생성
- [ ] 응답 음성으로 재생됨
- [ ] 자녀 대시보드에서 transcript 확인 가능
- [ ] **두 번째 발화 시 이전 발화가 컨텍스트로 자동 주입**

이 6가지가 되면 Sprint 0 완료.

---

## 14. 코딩 에이전트 행동 지침

### 14.1 작업 원칙
1. §13 Sprint 0를 T1~T9 순서대로.
2. 한 번에 하나만. 끝나면 짧은 요약 + 다음 진행 여부 묻기.
3. 모르면 추측 X. 사업 결정사항(가격/UX 톤 등)은 본인에게 묻기.
4. 컨벤션 충돌 시 §14.2 우선.
5. 어르신 화면 UX에 개인 의견 주입 X.

### 14.2 코딩 컨벤션
- TypeScript strict mode
- 함수: 동사 (`fetchUtterance` not `utterance`)
- 컴포넌트: PascalCase
- 유틸: kebab-case
- 서버 코드: `app/api/*/route.ts` 또는 Server Actions
- `'use client'`는 정말 필요한 곳만
- 환경 변수: `lib/env.ts`로 검증 후 export
- Supabase 쿼리: `lib/supabase/`에 함수로 묶음
- LLM 호출: `lib/ai/` 통해서. fetch 직접 금지
- 한국어 UI: `lib/i18n.ts`에 모음

### 14.3 절대 금기
- `raw_utterances` UPDATE/DELETE
- 어르신 화면에 "기록", "저장", "녹음", "수집" 단어
- 어르신 화면에 5개 초과 인터랙티브 요소
- 어르신 화면 광고/추천/외부 링크
- 자녀 대시보드에서 어르신 발화 원본 수정 (보충은 verifications에)
- API 키 하드코딩
- 사용자 입력 LLM 직접 전달 전 prompt injection 방어 X
- LoRA 학습 데이터에 실명/개인정보 포함

### 14.4 테스트 전략
- Phase 1: unit test 강박 X. **수동 시나리오 테스트** 우선
- 매 PR마다 직접 시나리오 실행: "사진 → 발화 → 저장 → 대시보드 → 두 번째 발화 시 retrieve"
- E2E (Playwright)는 Phase 2부터

### 14.5 모르는 결정은 사용자에게
- 가격/패키지 변경
- 캐릭터 톤 (어르신 호칭)
- UX 변경
- 보안/개인정보 처리
- Phase 전환 시점
- LoRA 분리 시점

기술 결정 (라이브러리, 함수명)은 §1, §5, §14.2 따라 자율.

---

## 15. Phase 진행 (기술 관점)

| Phase | 기간 | 기술 스택 변경 | LoRA 상태 | 메모리 |
|-------|------|----------|---------|------|
| Sprint 0 | 1주 | Next.js + Supabase + OpenAI | 없음 | 자체 (수동) |
| Phase 1 | 1~2개월 | + Whisper + 클로바보이스 + pgvector | 없음 | 자체 (자동) |
| Phase 2 | 3~6개월 | + 결제 + 알림톡 + 디바이스 키오스크 | **MOT-Agent v0.1 (단일 LoRA)** 학습 시작 | 자체 |
| Phase 3 | 6~12개월 | + Cogno (Vast.ai 4090 추론) | **2개 LoRA 분리** | 자체 |
| Phase 4 | 12~24개월 | + 자체 STT/TTS + Tailscale | **5개 LoRA 세분화** | 자체 |
| Phase 5 | 24개월+ | 자체 GPU 서버 또는 영구 클라우드 | LoRA 정기 재학습 (월 1회) | 자체 |

---

## 16. 리스크 및 결정 필요

### 기술 리스크
- 어르신 사투리 STT 정확도 (Phase 1 30회 발화 후 평가)
- 한국어 embedding 품질 (text-embedding-3-small vs KoSimCSE 비교 필요)
- pgvector ivfflat 인덱스 성능 (10만 발화 넘어가면 hnsw로 전환)

### 즉시 결정 필요
- [ ] 클로바보이스 voice_id 확정 (vara 권장)
- [ ] PWA 설치 강제 vs 브라우저 풀스크린
- [ ] embedding 모델: text-embedding-3-small vs 한국어 특화
- [ ] Phase 2 학습 시작 시점 (실데이터 30~50개 누적 후)
- [ ] Cogno 결합 시점 (Phase 3 초반? 중반?)

---

## 17. 참조

### 외부
- Supabase Auth + RLS: https://supabase.com/docs/guides/auth/row-level-security
- pgvector: https://github.com/pgvector/pgvector
- OpenAI Whisper: https://platform.openai.com/docs/guides/speech-to-text
- 네이버 클로바보이스: https://api.ncloud-docs.com/docs/ai-naver-clovavoice
- Vercel Cron: https://vercel.com/docs/cron-jobs
- Unsloth Qwen3.5/3.6: https://unsloth.ai/docs/models/qwen3.5/fine-tune

### 내부
- `MOT_BUSINESS_v4-A.md` — 사업 마스터 (정체성, 가격, BEP, 마케팅)
- 본 문서 = `mot/.ai/harness.md`로 사용
- 발췌 권장:
  - `/.ai/harness.md` (§0, §13, §14)
  - `/docs/ARCHITECTURE.md` (§1, §3, §5, §6)
  - `/docs/SCHEMA.md` (§4)
  - `/docs/PROMPTS.md` (§7)
  - `/docs/AI_STRATEGY.md` (§1, §15)

---

*v4-B / 2026-04-27*
*MOT Technical Harness for Coding Agents*
*변경 이력: v3 → v4 (LoRA 단계적 진화 + 메모리 시스템 자체 구현 + Sprint 0에 RAG 통합)*
