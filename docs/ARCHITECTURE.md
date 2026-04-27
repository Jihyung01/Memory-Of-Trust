# ARCHITECTURE.md — MOT 시스템 아키텍처

> Master Document v3 §4, §5, §7, §8 발췌. 기술 스택과 시스템 구성도.

---

## 4. 기술 스택 (Phase 1 기준 최종)

### 4-1. Frontend / Device

| 영역 | 선택 | 이유 |
|---|---|---|
| Framework | Next.js 15+ (App Router) | 어르신 화면/자녀 대시보드 통합 |
| Language | TypeScript | 타입 안정성 |
| Styling | Tailwind CSS v4 + shadcn/ui | 빠른 UI |
| 상태 관리 | Zustand + React Query | 가볍고 명확함 |
| 디바이스 모드 | PWA (Phase 1) → Expo Android 래퍼 (Phase 2) | 빠른 반복 후 안정성 |
| 키오스크 | Phase 1: Chrome PWA Fullscreen / Phase 2: Lock Task Mode | 어르신은 앱이 아닌 기계로 인지 |

### 4-2. Backend / Infra

| 영역 | 선택 | 이유 |
|---|---|---|
| 호스팅 | Vercel | 빠른 배포 |
| DB / Auth / Storage | Supabase (Postgres + RLS) | 통합 인프라 |
| 워커 | Vercel Cron (Phase 1) → Inngest 또는 Railway (Phase 2+) | 장시간 LLM 후처리 |
| 결제 | 토스페이먼츠 | 한국 결제 표준 |
| 알림 | 카카오 알림톡 + SendGrid | 한국 가족 도달률 |

### 4-3. AI Layer (Phase별 전략)

#### Phase 1 (1명) — 외부 API 우선, 빠른 검증

| 작업 | 모델 | 이유 |
|---|---|---|
| VAD | Silero VAD (로컬, 무료) | 침묵 감지로 STT 비용 절감 |
| STT | OpenAI Whisper API (`whisper-1`) | 한국어 사투리 정확도 |
| 응답 생성 | GPT-4o-mini | 짧은 응답에 충분, 저렴 |
| TTS | 네이버 클로바보이스 (`vara` 또는 `nshin`) | 한국어 자연성 |
| 후처리 (8축 추출, 카드 생성) | GPT-4o (배치, 야간) | 깊이 있는 분석 |

#### Phase 2 (5가구) — 하이브리드, Cogno 결합 시작

- 실시간 응답: GPT-4o-mini 유지
- 후처리는 Cogno (Vast.ai 4090, Qwen3.6:35b)로 이전 — 야간 배치
- TTS는 클로바보이스 유지 (음질 우선)

#### Phase 3 (10~20가구) — 풀 오픈소스 자체 호스팅

- STT: faster-whisper-large-v3 (자체)
- LLM: Cogno (Qwen3.6:35b)
- TTS: XTTS-v2 (보이스 클로닝, 캐릭터 일관성)
- VAD: Silero VAD

### 4-4. 비용 모델 (가구당 월)

| Phase | 외부 API | Cogno 분담 | 합계 | 9.9만 구독 마진 |
|---|---|---|---|---|
| Phase 1 | ~1.5만원 | 0 | 1.5만원 | 8.4만원 |
| Phase 2 | ~1만원 | ~5천원 | 1.5만원 | 8.4만원 |
| Phase 3 | ~3천원 | ~5천원~1만원 | 1만원 | 8.9만원 |

---

## 5. 시스템 아키텍처

```
┌─────────────────────────────────────────────────┐
│  [디바이스: 7인치 태블릿 + Kiosk Mode]            │
│   Next.js PWA (어르신 화면)                       │
│   - 시계 + 사진 슬라이드 + 한 문장 + 마이크 버튼   │
│   - VAD → 녹음 → 업로드 → 응답 재생              │
└─────────────────────────────────────────────────┘
                  ↕  HTTPS / Realtime
┌─────────────────────────────────────────────────┐
│  [Next.js on Vercel]                            │
│   - 어르신 디바이스 페이지: /device/[deviceId]    │
│   - 자녀 대시보드: /family/*                     │
│   - API: /api/utterances, /api/photos, ...     │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│  [Supabase]                                     │
│   - Postgres (RLS로 가족 권한 분리)              │
│   - Auth (자녀 로그인)                           │
│   - Storage (사진, 음성 녹음)                    │
│   - Realtime (디바이스 ↔ 백엔드 동기화)          │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│  [AI Layer]                                     │
│   Phase 1: OpenAI (Whisper, 4o-mini, 4o)        │
│           + 네이버 클로바보이스 TTS              │
│   Phase 2+: + Cogno (Vast.ai 4090, Qwen3.6:35b) │
│   Phase 3+: faster-whisper + XTTS-v2 자체       │
└─────────────────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────────────────┐
│  [Worker / Cron]                                │
│   - 매주 일 21:00: 주간 카드 생성              │
│   - 매월 말일 21:00: 월간 챕터 생성            │
│   - 매일 야간: 8축 데이터 추출                  │
│   - 알림 발송: 카카오 알림톡 + 이메일            │
└─────────────────────────────────────────────────┘
```

---

## 7. 파일 구조

```
mot/
├── .ai/
│   ├── harness.md              # 에이전트가 가장 먼저 읽는 문서
│   ├── conventions.md          # 코딩 컨벤션
│   └── AGENT_INDEX.md          # 에이전트 카탈로그
├── AGENTS.md                   # Codex 운영 규칙
├── CLAUDE.md                   # Claude Code 운영 규칙
├── agent-prompts/              # 역할별 프롬프트 (모델 명시)
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMA.md
│   ├── PROMPTS.md
│   └── ROADMAP.md
├── scripts/                    # Windows 배치 스크립트
├── app/
│   ├── (device)/               # 어르신용 화면 (kiosk)
│   │   └── device/
│   │       └── [deviceId]/
│   │           ├── page.tsx
│   │           ├── ambient.tsx
│   │           └── components/
│   │               ├── BigClock.tsx
│   │               ├── PhotoFrame.tsx
│   │               ├── PromptBubble.tsx
│   │               └── MicButton.tsx
│   ├── (family)/               # 자녀 대시보드
│   │   └── family/
│   │       ├── login/
│   │       ├── [elderId]/
│   │       │   ├── page.tsx
│   │       │   ├── photos/page.tsx
│   │       │   ├── questions/page.tsx
│   │       │   ├── cards/page.tsx
│   │       │   └── chapters/page.tsx
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
│   │   │   └── soften/route.ts
│   │   ├── photos/upload/route.ts
│   │   ├── questions/route.ts
│   │   └── cron/
│   │       ├── weekly-card/route.ts
│   │       ├── monthly-chapter/route.ts
│   │       └── extract-axes/route.ts
│   └── layout.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── ai/
│   │   ├── openai.ts
│   │   ├── clova.ts
│   │   ├── cogno.ts
│   │   ├── prompts.ts
│   │   └── extract-axes.ts
│   ├── voice/
│   │   ├── vad.ts
│   │   └── recorder.ts
│   ├── kakao/
│   │   └── alimtalk.ts
│   ├── billing/
│   │   └── toss.ts
│   ├── env.ts
│   ├── i18n.ts
│   └── types.ts
├── supabase/
│   ├── migrations/
│   │   ├── 20260427000001_initial_schema.sql
│   │   └── 20260427000002_rls_policies.sql
│   └── seed.sql
├── public/
│   ├── manifest.json
│   ├── icon-192.png
│   ├── icon-512.png
│   └── sounds/
├── styles/
│   └── globals.css
├── .env.example
├── .env.local                  # gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. API 엔드포인트 명세

### 8-1. 디바이스 API

```
POST /api/device/auth
  Body: { device_token: string }
  Response: { elder_id: string, session_token: string }

GET /api/device/next-prompt?device_token=...
  Response: {
    prompt_id: string,
    prompt_type: 'photo_trigger' | 'family_question' | 'follow_up' | 'open_check_in',
    prompt_text: string,
    photo_url?: string,
    photo_caption?: string,
    speak_now: boolean
  }

POST /api/device/utterance
  Body: FormData {
    audio: Blob,
    prompt_id: string,
    started_at: ISO,
    ended_at: ISO
  }
  Response: {
    utterance_id: string,
    transcript: string,
    response_text: string,
    response_audio_url: string  // TTS 결과
  }
```

### 8-2. 자녀 API

```
POST /api/photos/upload
  Body: FormData { file, caption?, approximate_year? }

POST /api/questions
  Body: { raw_question: string }
  → AI가 softened_question 자동 생성

GET /api/cards?week=YYYY-WW
GET /api/chapters?month=YYYY-MM
```

### 8-3. Cron API

```
POST /api/cron/weekly-card
  Trigger: 매주 일 21:00 KST (Vercel Cron)
  Auth: x-cron-secret 헤더
  → 그 주 발화로 주간 카드 생성 + 가족에게 전송

POST /api/cron/monthly-chapter
  Trigger: 매월 마지막 주 일요일 21:00 KST

POST /api/cron/extract-axes
  Trigger: 매일 새벽 3:00 KST
  → 전날 발화에서 8축 데이터 추출 (배치)
```

---

## 17. Cogno 결합 (Phase 2부터)

### Phase 2 — 후처리만 Cogno로

- 주간 카드 생성 (`/api/cron/weekly-card`) → Cogno
- 8축 추출 (`/api/cron/extract-axes`) → Cogno
- 실시간 응답 (디바이스 ↔ 어르신 대화)는 OpenAI 유지 (속도 우선)

### Phase 3 — 풀 자체 호스팅

- `/api/llm/respond` → Cogno
- `/api/stt` → faster-whisper (자체 호스팅)
- `/api/tts` → XTTS-v2 (보이스 클로닝)

### Phase 4 — Cogno 진화

- MOT 발화 데이터로 Cogno 한국어 어르신 도메인 파인튜닝
- 정서적 한국어 데이터 = Cogno만의 학습 자산

### MCP 결합 (선택)

Cogno에 MCP 서버 형태로 다음 도구 노출:

- `mot.next_prompt(elder_id)` — 다음 프롬프트 결정
- `mot.recall_recent(elder_id, n)` — 최근 발화 회수
- `mot.unresolved_items(elder_id)` — 미해결 큐 조회

이렇게 하면 Cogno가 MOT의 "두뇌" 역할을 하면서, 다른 프로젝트(WhereHere, 진드기맨)와도 자원 공유 가능.

---

_v3 / 2026-04-27_
