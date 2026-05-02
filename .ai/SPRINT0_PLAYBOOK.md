# SPRINT 0 PLAYBOOK — 단계별 실행 매뉴얼

> 다른 노트북으로 옮겨와서 작업 이어갈 때 이 파일만 보면 된다.
> 각 단계: **어디서 / 어떤 모델 / 무엇을 붙여넣고 / 무엇을 검증할지** 까지 명시.

---

## 0. 새 노트북 첫 셋업 (한 번만)

```powershell
# 1) 폴더 받기
git clone <레포 URL> mot
cd mot

# 2) 환경 변수 (이전 노트북의 .env.local 값을 다시 입력)
copy .env.example .env.local
notepad .env.local
# Supabase URL/anon/service_role, OpenAI key, 클로바 ID/Secret/voice_id,
# DEVICE_AUTH_SECRET, CRON_SECRET 채우기

# 3) 의존성
npm install

# 4) 도구 확인
node -v          # v20+
git --version
codex --version  # Codex CLI (앱이면 OK)
claude --version # Claude Code
```

---

## 1. 진행 트래커 (체크하면서 진행)

> **상태: Sprint 0 ✅ 종결 (2026-05-02). Phase 1 진입 직전. §7 진입 큐 참조.**

이 트래커는 두 갈래다:
- **A. 초기 빌드 (구 트래커, T1~T8)** — Codex CLI/Claude Code 첫 통과로 완료.
- **B. 검증 패스 (Claude Opus 4.7 + Codex 협업, harness §13 기준)** — 누락된 RAG/RLS 토대를 실제로 박은 두 번째 통과. 2026-05-02 진행.

### 1-A. 초기 빌드 (1차 통과)

| Task | 설명 | 도구 / 모델 | 상태 |
|---|---|---|---|
| T1 | next-app 스캐폴드 + lib + PWA manifest | Codex / gpt-5.5 | ✅ |
| T2 | Supabase 스키마 + RLS + seed (운영 migrations) | (수동 SQL Editor) | ✅ |
| T3 | 디바이스 인증 + 다음 프롬프트 API | Codex / gpt-5.5 | ✅ |
| T4 | 어르신 디바이스 화면 (시계/사진/마이크) | Codex / gpt-5.5 | ✅ |
| T5 | 음성 녹음 + STT + raw_utterances 저장 | Codex / gpt-5.5 | ✅ |
| T6 | LLM 응답 + TTS (Edge TTS) + audio_url | Codex / gpt-5.5 | ✅ |
| T7 | 자녀 대시보드 (로그인 + 발화 목록 + 사진 업로드) | Codex / gpt-5.5 | ✅ |
| T8 | DoD 시나리오 수동 테스트 | (사용자 본인) | ✅ |

### 1-B. 검증 패스 (Claude Opus 4.7 + Codex, 2026-05-02)

harness §13 명세 기준으로 1차 통과 결과를 검증하면서 발견한 갭을 메운 작업.

| Step | 발견/작업 | 결과 |
|---|---|---|
| T1 픽스 | `.env.example` ↔ `lib/env.ts` 키 정렬 (NAVER_CLOVA 제거, GEMINI/GROQ/ENABLE_DEV_PAGE 추가) | ✅ |
| T2 픽스 | 신규 마이그레이션 `20260502000001_pgvector_rag.sql` (`vector` ext + `utterance_embeddings` + `match_utterances` RPC + RLS + grants) | ✅ Supabase 적용됨 |
| T2 부산물 (A1) | `fetchMemoryContextForResponse` 8축 컨텍스트 주입 + 에러 폴백 + 6필드 길이 캡 (entities.name 50, themes 80, unresolved.excerpt 200, sensory.detail/context 100, recentUtterances.transcript 300) | ✅ |
| T3 신규 | `lib/ai/embedding.ts` (createEmbedding/Batch, 1536 차원 검증, OPENAI_API_KEY 가드) + `lib/memory/{embed,retrieve,format-context}.ts` | ✅ |
| T4 검증 | `/api/device/{auth,next-prompt,utterance}` 보안/명세 통과 — HMAC, raw_utterances immutable, fallback 체인 | ✅ (리뷰① 흡수) |
| T5 픽스 | `DevicePageClient.tsx` 한국어 리터럴 3건 → `ko.elder.{listeningHint,statusListening,statusConnected}` | ✅ |
| T6 hook | `app/api/device/utterance/route.ts` raw_utterances INSERT 직후 `embedUtterance` 자동 호출 (await + try/catch graceful) | ✅ |
| T7 통합 | `/api/llm/respond` 에 `retrieveSimilarUtterances` 통합 (topK=3, threshold=0.7, 자기 자신 제외) → `formatMemoryContext({ ...memoryContext, similarUtterances })` | ✅ |
| T8 DoD | 6개 항목 전부 통과 (§6 참조). family-photos Storage 버킷 추가로 마지막 §E 통과 | ✅ |
| 리뷰①·④ | T4·T7 검증 패스에 흡수 | ✅ |
| 검수② Elder UX Guardian | 정식 검수 미실시 (큰 갭만 처리) | ⬜ Phase 1 Week 1 |

---

## 2. 단계별 명령 (시간순)

각 명령은 그대로 복사·붙여넣기 가능. 모델은 각 코드블럭 위에 명시.

---

### 🟦 T3 — 디바이스 인증 + 다음 프롬프트 API

**도구**: Codex 앱 / **모델**: `gpt-5.5` / **작업 폴더**: `Memory-Of-Trust`

```text
T1 잔여 완료 확인. 다음으로 진행:

[T1 마무리 — 빌드 통과시키기]
- npm install -D @tailwindcss/postcss
  (사용자 승인 후 실행)
- 그 후 npm run build 가 통과하는지 확인

[T2 상태]
- Supabase 스키마 + RLS + seed 적용 완료 (사용자가 SQL Editor에서 직접 실행함)
- 따라서 T2는 건너뛴다

[T3 시작]
- app/api/device/auth/route.ts
  · POST { device_token } → { elder_id, session_token }
  · DEVICE_AUTH_SECRET 으로 HMAC 검증 (평문 비교 금지)
- app/api/device/next-prompt/route.ts
  · 가장 적게 보여준 active 사진 1장 선택 (photos.shown_count ASC)
  · lib/ai/openai.ts 신규 작성 (env.OPENAI_API_KEY 사용, 모델은 env.OPENAI_RESPONSE_MODEL)
  · lib/ai/prompts.ts 의 photoTriggerPrompt 호출
  · 응답: { prompt_id, prompt_type, prompt_text, photo_url, photo_caption }
  · prompts 테이블에 INSERT 후 prompt_id 반환

규칙:
- 패키지 매니저는 npm. pnpm 명령 사용 금지.
- env 접근은 lib/env.ts 통해서만. process.env 직접 접근 금지.
- Supabase 쿼리는 lib/supabase/server.ts 통해서만 (없으면 같이 신규 작성).
- LLM 호출은 lib/ai/openai.ts 통해서만. 직접 fetch 금지.
- raw_utterances는 이번 Task에서 안 건드림.
- 어르신 화면 코드는 이번 Task에서 안 건드림.

T3 완료 시 검증:
- npm run build 통과
- /api/device/auth 호출 시나리오 설명 (실행은 다음 단계)

T3 끝나면 멈추고 보고해라.
```

**검증**: `npm run build` 통과, 새 파일 생김 (`app/api/device/auth/route.ts`, `app/api/device/next-prompt/route.ts`, `lib/ai/openai.ts`, `lib/supabase/server.ts`).

---

### 🟪 리뷰① — T3 diff 리뷰

**도구**: Claude Code (`claude` CLI) / **모델**: `claude-opus-4-7` / **작업 폴더**: `Memory-Of-Trust`

먼저 PowerShell:
```powershell
git add -A
git diff --staged > diff-t3.txt
claude
```

Claude Code 채팅에 붙여넣기:

```text
agent-prompts/03_reviewer_claude.md 의 검토 기준대로 다음 diff를 리뷰해라.
파일: diff-t3.txt

중점 검토:
1. /api/device/auth 의 device_token 검증이 평문 비교(===)가 아닌 HMAC 또는 timing-safe 비교인가?
2. SUPABASE_SERVICE_ROLE_KEY 가 클라이언트로 노출되는 경로는 없는가?
3. lib/env.ts 를 거치지 않고 process.env 직접 접근하는 코드 있는가?
4. raw_utterances 를 우회로라도 건드리는 코드 있는가? (이 단계에선 없어야 함)
5. /api/device/next-prompt 가 RLS 우회를 service_role 만으로 하는가? anon 키로 다른 가구 elder 데이터 새지 않는가?
6. prompt injection 방어가 photoTriggerPrompt 호출에 있는가? (이번엔 가족 입력 안 들어가지만 future-proof)

출력은 03_reviewer_claude.md §리뷰 출력 예시 그대로:
- 승인 가능 여부
- 반드시 고칠 점
- 선택적 개선
- 본질 환기 self-check
```

**처리**: Approve면 다음 T4로. Block/Request Changes면 그 사유를 Codex에 다시 던져 수정.

---

### 🟦 T4 — 어르신 디바이스 화면

**도구**: Codex 앱 / **모델**: `gpt-5.5`

```text
T3 + 리뷰① 통과. 다음으로 진행:

[T4 시작 — 어르신 디바이스 화면]

목표: app/(device)/device/[deviceId]/page.tsx
- 큰 시계 (좌측 또는 상단, BigClock 컴포넌트로 분리)
- 사진 한 장 (중앙, 큰 사이즈, PhotoFrame 컴포넌트)
- 한 문장 (사진 아래, PromptBubble 컴포넌트)
- 마이크 버튼 (큰, 하단 중앙, MicButton 컴포넌트 — 이 단계에선 클릭 시 console.log만, 실제 녹음은 T5)
- 컴포넌트 위치: app/(device)/device/[deviceId]/components/

UI 규칙 (절대):
- 폰트 최소 text-3xl, 마이크 버튼은 더 크게
- 색상: 베이지/우드 톤 (예: bg-amber-50, bg-stone-100, text-stone-800). 어두운 배경 금지.
- 인터랙티브 요소 5개 이하. 시계·사진·문장·마이크 외 거리 산만한 요소 금지.
- 한국어 UI 텍스트는 lib/i18n.ts 의 ko.elder 만 사용. 컴포넌트에 한국어 리터럴 직접 작성 금지.
- 금지어 절대 노출 금지: "기록되었습니다", "저장합니다", "녹음합니다", "수집합니다",
  "어떻게 도와드릴까요", "무엇을 도와드릴까요", "힘내세요", "긍정적으로", "오류가 발생했습니다",
  "AI", "인공지능", "챗봇"
- PWA fullscreen 강제 (manifest.json 의 display: standalone 활용)
- STT/LLM 실패 시 화면이 깨지지 않고 시계+사진으로 자연 폴백

데이터:
- 페이지 진입 시 GET /api/device/next-prompt?device_token=... 호출하여 사진 + 한 문장 받아옴
- 마이크 버튼 클릭은 이번 단계에선 visual 토글만 (실제 녹음/업로드는 T5)

T4 끝나면 멈추고 보고해라. 어르신 화면 변경은 다음 단계에서 Elder UX Guardian 검수가 필수다.
```

**검증**: 로컬 `npm run dev` → `http://localhost:3000/device/<deviceId>` 접속 (deviceId는 seed의 device_token 사용) → 시계/사진/문장/마이크 4개만 보이는지.

---

### 🟪 검수② — Elder UX Guardian

**도구**: Claude Code / **모델**: `claude-opus-4-7`

먼저 PowerShell:
```powershell
git add -A
git diff --staged > diff-t4.txt
claude
```

Claude Code 채팅:

```text
너는 agent-prompts/08_elder_ux_guardian_claude.md 의 Elder UX Guardian이다.
거부권 보유자.

검수 대상:
- diff-t4.txt
- app/(device)/device/[deviceId]/page.tsx 와 components/* 의 모든 한국어 문자열
- lib/i18n.ts 의 ko.elder 변경분
- 추가된 사운드/효과음

08_elder_ux_guardian_claude.md §1 금지 단어, §2 금지 톤, §3 금지 UI 패턴, §4 금지 사운드를 모두 적용.

본질 자가 점검:
"이 화면을 본 80세 어르신이 '이건 기계인가? 또 누가 나를 들여다보는 도구인가?' 둘 중 무엇으로 인지할까?"
'기계'여야 통과. '들여다보는 도구'면 거부.

출력: ✅ Pass / ⛔ Block + 발견 + 권장 대안.
```

**처리**: Pass면 다음 단계. Block이면 권장 대안을 Codex에 던져 수정 → 재검수.

---

### 🟪 설계③ — T5 시작 전 설계 (raw_utterances 안전성)

T5는 raw_utterances에 처음 INSERT가 일어나는 시점. 위험 분석 필수.

**도구**: Claude Code / **모델**: `claude-opus-4-7`

```text
너는 agent-prompts/01_architect_claude.md 의 Architect다.

목표:
T5 (음성 녹음 + STT + raw_utterances 저장)의 안전한 실행 계획을 세운다.

먼저 정독:
- CLAUDE.md
- .ai/harness.md (특히 §0-1 Hard Don'ts)
- docs/SCHEMA.md (특히 §6-4 불변식)
- docs/ARCHITECTURE.md §8-1 디바이스 API
- supabase/migrations/20260427000001_initial_schema.sql (raw_utterances 트리거)
- lib/ai/prompts.ts (이번 Task에선 안 건드림)

핵심 위험:
1. raw_utterances 는 immutable. 트리거가 UPDATE/DELETE 차단. INSERT만 가능.
2. audio Blob → Supabase Storage 업로드가 실패하면 raw_utterances 가 audio_url 없이 INSERT 되면 안 된다 (트랜잭션처럼).
3. Whisper API 가 비용·지연이 있으니 클라이언트가 중복 요청하지 않도록 idempotency 필요.
4. service_role 키 노출 금지.
5. STT 실패 시 어르신 화면이 깨지지 않아야 한다.

출력 (8개 섹션):
1. Diagnosis
2. Affected Areas
3. Likely Root Causes / Design Considerations
4. Files to Inspect / Create
5. Files NOT to Touch (특히 trigger, RLS, env 키 이름)
6. Minimal Safe Plan (트랜잭션 / 폴백 / 중복 방지 포함)
7. Execution Steps for Codex (번호 매긴 명령형, 그대로 복붙 가능)
8. Validation & Rollback
```

**처리**: Architect 출력의 §7 Execution Steps를 그대로 복사 → 다음 T5 명령으로 사용.

---

### 🟦 T5 — 음성 녹음 + STT + 저장

**도구**: Codex 앱 / **모델**: `gpt-5.5`

```text
[T5 시작 — 음성 녹음 + STT + raw_utterances 저장]

다음은 Claude Architect (claude-opus-4-7) 가 만든 실행 계획이다. 그대로 따른다.

[여기에 설계③ 의 Architect 출력 §7 Execution Steps 전체를 붙여넣음]

추가 규칙:
- raw_utterances 는 immutable. UPDATE/DELETE 코드 작성 금지.
- audio 업로드 실패 시 raw_utterances INSERT 도 안 한다 (트랜잭션 또는 보상 로직).
- Whisper 호출은 반드시 language: "ko" 강제.
- 패키지 매니저 npm.

T5 완료 시 검증:
- npm run build 통과
- 시나리오: 디바이스 페이지에서 마이크 클릭 → 5초 녹음 → STT → DB raw_utterances 1개 INSERT 확인
- Supabase Studio Table Editor 에서 raw_utterances row 직접 확인

T5 끝나면 멈추고 보고.
```

---

### 🟦 T6 — LLM 응답 + TTS

**도구**: Codex 앱 / **모델**: `gpt-5.5`

```text
[T6 시작 — LLM 응답 + 클로바 TTS]

목표:
- app/api/llm/respond/route.ts
  · 입력: { utterance_id, transcript } 또는 elder_id + 직전 발화 fetch
  · lib/ai/prompts.ts 의 ELDER_CHARACTER_SYSTEM_PROMPT + 직전 발화로 1~2문장 응답 생성
  · 모델: env.OPENAI_RESPONSE_MODEL (기본 gpt-4o-mini)
- app/api/tts/route.ts
  · lib/ai/clova.ts 신규 작성 — env.NAVER_CLOVA_VOICE_* 사용
  · 입력: { text }
  · 응답: mp3 binary 또는 signed Storage URL
- 디바이스 페이지: T5 발화 업로드 응답 후 → /api/llm/respond → /api/tts 체인 → <audio autoPlay>

규칙:
- 응답 텍스트에 lib/ai/prompts.ts 금지어 자동 회귀 검사 (있으면 일반 짧은 추임새로 폴백).
- TTS 실패 시 어르신 화면이 깨지지 않고 사진+시계로 폴백.
- Storage 업로드 시 signed URL 만 노출 (public 금지).
- 패키지 매니저 npm.

T6 완료 시 검증:
- 시나리오: 마이크 발화 → STT → 응답 텍스트 → 클로바 TTS → 디바이스에서 자동 재생 확인
- 한국어 자연성이 어색하면 NAVER_CLOVA_VOICE_VOICE_ID 를 vara → nshin → nara 순으로 시도

T6 끝나면 멈추고 보고.
```

---

### 🟦 T7 — 자녀 대시보드

**도구**: Codex 앱 / **모델**: `gpt-5.5`

```text
[T7 시작 — 자녀 대시보드 최소 버전]

목표:
1. Supabase Auth 매직링크 로그인
   - app/(family)/family/login/page.tsx
   - lib/supabase/client.ts (브라우저용 anon key)
2. app/(family)/family/[elderId]/page.tsx
   - 발화 목록 (raw_utterances, 최근순, 50개)
   - lib/i18n.ts 의 ko.family.utterances 사용
3. app/(family)/family/[elderId]/photos/page.tsx
   - 사진 업로드 폼 (FormData → /api/photos/upload → Supabase Storage)

규칙:
- 자녀는 anon key로 RLS 통해 접근. service_role 절대 클라이언트 노출 X.
- 자녀가 raw_utterances UPDATE/DELETE 시도하는 UI 만들지 않는다 (immutable).
- 가족 query 는 lib/supabase/* 함수로 묶어서.
- 한국어 UI 는 lib/i18n.ts ko.family.* 만 사용.
- Tailwind 일반 톤 OK (어르신 화면 규칙 적용 X).
- 패키지 매니저 npm.

T7 완료 시 검증:
- npm run build 통과
- 시나리오:
  · 매직링크로 로그인 (Supabase Studio에서 user 추가하고 family_members.user_id 갱신 필요할 수 있음)
  · /family/<elderId> 페이지에서 발화 목록 표시
  · /family/<elderId>/photos 에서 사진 업로드 → DB photos 테이블 INSERT 확인

T7 끝나면 멈추고 보고.
```

---

### 🟪 리뷰④ — T7 끝나고 RLS 검증

**도구**: Claude Code / **모델**: `claude-opus-4-7`

```text
너는 agent-prompts/03_reviewer_claude.md 의 Reviewer다.

검수 대상:
- diff-t7.txt
- app/(family)/* 전체
- lib/supabase/client.ts, lib/supabase/server.ts

중점:
1. anon key 와 service_role key 사용처 분리 정확한가?
2. /api/photos/upload 가 family_members.user_id == auth.uid() 검증 후에만 INSERT 하는가?
3. RLS 정책으로 다른 가구 데이터 누설 가능성 시뮬레이션:
   · 다른 가족이 만든 elder 의 photos 를 anon 키로 SELECT 시도 → 막혀야 함
   · raw_utterances 를 anon UPDATE 시도 → 트리거+RLS 둘 다로 막혀야 함
4. Storage 정책: 다른 가구 음성 파일에 signed URL 없이 직접 접근 가능한 경로 있는가?
5. 자녀가 raw_utterances 를 수정/삭제할 수 있는 UI 가 들어왔는가? (들어오면 ⛔)

출력: 03_reviewer_claude.md §리뷰 출력 예시 그대로.
```

---

### 🟧 T8 — DoD 시나리오 수동 테스트

**도구**: 사용자 본인 (브라우저)

체크리스트:
- [ ] `npm run dev` 실행
- [ ] 어르신 디바이스 페이지 (`http://localhost:3000/device/<token>`) 열림
- [ ] 시계 + 사진 + 한 문장 + 마이크만 보임. 금지어 없음.
- [ ] 마이크 버튼 클릭 → 30초 발화 → 자동 종료 또는 재클릭으로 종료
- [ ] AI 한 문장 응답이 음성으로 자동 재생됨
- [ ] Supabase Table Editor → `raw_utterances` 에 새 row INSERT 확인 (transcript 채워짐)
- [ ] 자녀 대시보드 (`/family/<elderId>`) → 그 발화가 목록에 표시됨
- [ ] 자녀 대시보드 사진 업로드 → 다음 디바이스 발화 트리거 시 새 사진 사용됨

3개 핵심 (DoD):
- [ ] 사진 보고 어르신이 한 마디 → 30초 안에 DB 영구 저장
- [ ] AI가 부드럽게 한 문장 응답하고 음성 재생
- [ ] 자녀가 웹 대시보드에서 transcript 열람

이 3개 통과 → **Sprint 0 완료. Phase 1 진입.**

---

## §6. T8 마무리 검증 (마이크/스피커 없는 환경 변형)

원래 DoD를 작업 데스크톱 환경에 맞게 변형. 이 5개만 직접 클릭으로 통과시키면 Sprint 0 종료.

### A. 디바이스 페이지 정상 표시
- [ ] `http://localhost:3002/device/tab-jihyung-001` 접속
- [ ] 시계 + 사진 + 한 문장 + 마이크 버튼 4요소만 보임
- [ ] 콘솔에 401 / NotFoundError 외 에러 없음 (마이크 NotFoundError는 정상 — 데스크톱에 마이크 없음)

### B. dev 발화 시뮬레이션 → 응답 표시
- [ ] [dev] 패널에 한국어 한 문장 입력 (예: "결혼식 날 너무 떨렸어요")
- [ ] 전송 후 화면 한 문장 영역에 AI 응답 표시 (예: "그러셨어요...", "어떤 마음이 드셨어요?" 같은 1~2문장)

### C. DB INSERT 확인
- [ ] Supabase Studio → Table Editor → `raw_utterances`
- [ ] 새 row 1개 (transcript = 입력한 문장, audio_url = null)
- [ ] `prompts` 에도 photo_trigger row 1개

### D. TTS audio_url 생성 확인 (재생 X)
- [ ] DevTools Console 에 `[tts] took <ms>ms` 로그
- [ ] `/api/tts` 응답에 audio_url (Supabase tts-cache signed URL) 200
- [ ] (선택) audio_url 클릭 → mp3 다운로드 → 핸드폰에서 재생해 캐릭터 톤 1회 확인

### E. 자녀 대시보드 발화 표시
- [x] `http://localhost:3002/family/login` 매직링크 로그인 (메일함 확인)
- [x] `http://localhost:3002/family/00000000-0000-0000-0000-000000000001` 접속
- [x] 방금 입력한 transcript 가 발화 목록에 표시
- [x] `/family/<elderId>/photos` → 사진 업로드 폼 동작 확인 (**family-photos Storage 버킷 수동 생성 필요했음 — 신규 환경 셋업 시 주의**)

A~E 모두 통과 → **Sprint 0 ✅ 완료 (2026-05-02). Phase 1 진입.**

### Sprint 0 §13 DoD 6개 — 전부 통과
- [x] 사진 보고 한 마디 → 30초 내 DB 영구 저장
- [x] **자동 embedding 생성됨 (utterance_embeddings에 행 추가)** ← T2 + T6 hook
- [x] AI가 RAG 활용해서 부드러운 응답 생성 ← A1 + T7 통합
- [x] 응답 음성으로 재생됨 (Edge TTS 또는 browser TTS 폴백)
- [x] 자녀 대시보드에서 transcript 확인 가능
- [x] **두 번째 발화 시 이전 발화가 컨텍스트로 자동 주입** ← T7 의미 검색 통합

### Storage 버킷 체크리스트 (신규 환경 셋업 시)
Supabase Dashboard → Storage → New bucket (private, public OFF):
- [ ] `family-photos`
- [ ] `utterances`
- [ ] `tts-cache`

마이크/스피커 본격 검증은 `docs/PHASE1_PLAYBOOK.md` Week 2 (실제 7인치 태블릿 셋업) 에서.

---

## 3. 막혔을 때 응급 매뉴얼

| 증상 | 1차 도구 | 프롬프트 |
|---|---|---|
| Codex가 자꾸 헤맴 | Claude Code | `agent-prompts/01_architect_claude.md` 사용해서 다시 계획 받기 |
| 운영 장애 / 빌드 깨짐 | Codex | `agent-prompts/04_bugfix_codex.md` 프롬프트 본체 |
| 어르신 화면 톤 의심 | Claude Code | `agent-prompts/08_elder_ux_guardian_claude.md` 검수 |
| LLM 응답 어색함 | Claude Code | `agent-prompts/07_prompt_engineer_claude.md` 튜닝 |
| 배포 직전 점검 | Codex | `agent-prompts/05_release_check_codex.md` |

---

## 4. 노트북 옮길 때 체크리스트

옮기기 전 (현 노트북):
```powershell
cd C:\Users\SAMSUNG\Memory-Of-Trust
git add -A
git commit -m "checkpoint: Sprint 0 진행 중 - T<n> 까지"
git push origin main
```

옮긴 후 (새 노트북):
```powershell
git clone <repo-url> mot
cd mot
copy .env.example .env.local
# .env.local 다시 채우기 (시크릿은 git에 안 올라감)
npm install
codex --version
claude --version
# 그리고 .ai/SPRINT0_PLAYBOOK.md (이 파일) 다시 보면서 멈췄던 단계부터 진행
```

---

## 5. 새 Cowork / Claude / Codex 대화에서 시작할 때

### 5-A. Phase 1 진입 후속 작업 (Sprint 0 종결 후 — 권장)

새 Claude Code 대화창에 첫 메시지:

```text
이 폴더(Memory-Of-Trust)는 MOT 프로젝트다. Sprint 0 ✅ 종결, Phase 1 진입 직전.

다음 파일을 정독해라:
- CLAUDE.md
- .ai/harness.md
- .ai/SPRINT0_PLAYBOOK.md §1-B 검증 패스 결과 + §7 Phase 1 진입 큐

다음으로 시작할 것: [§7 큐에서 골라 한 줄로]

§5 출력 스타일(Diagnosis / Risk / Recommended Plan / Execution Steps / Validation / Rollback)대로 진행한다.
Codex 작업이 필요하면 프롬프트를 짜주고, 실제 실행은 사용자가 한다.
```

### 5-B. Sprint 0 도중 (구 — 이미 종결됐으므로 사용 X)

(기존 트래커 진행 중에만 의미 있던 템플릿. 보존만.)

```text
이 폴더(Memory-Of-Trust)는 MOT 프로젝트다.
다음 파일들을 정독해라:
- AGENTS.md (Codex 규칙) 또는 CLAUDE.md (Claude 규칙)
- .ai/harness.md
- .ai/SPRINT0_PLAYBOOK.md (이 매뉴얼)

현재 진행 상태: §1 진행 트래커의 [내가 끝낸 마지막 ✅ 단계]
다음으로 시작할 것: [트래커의 ⬜ 첫 항목]

§2 의 해당 단계 명령을 그대로 실행한다.
```

---

## 7. Phase 1 진입 큐 (Sprint 0 종결 후 처리할 것)

복귀 시 이 리스트로 시작. 우선순위 순.

### 🔴 Phase 1 어르신 실사용 직전 필수

| # | 항목 | 비용/규모 | 메모 |
|---|---|---|---|
| 1 | **TTS 안정화** — Edge TTS 5초 타임아웃 빈번 → browser TTS 폴백 → 손주 같은 작가 톤 깨짐 | OpenAI TTS-1 = 약 180원/월/가구. 비용 무시 가능 | 단계: (a) Edge 타임아웃 5→8초, (b) 그래도 불안정하면 OpenAI TTS-1 전환. Phase 4(50가구) 시점 XTTS-v2 자체 호스팅 |
| 2 | **Elder UX Guardian 정식 검수** — `agent-prompts/08_elder_ux_guardian_claude.md` 기준 | - | MOT 헤더 브랜드, VuMeter speaking active, 폰트 크기 등 디자인 결정 일괄 |
| 3 | **Sentry 통합** — STT/LLM/TTS API 실패 모니터링 | 무료 티어 충분 | T1 deferral 항목. 어르신 실사용 시작 시 이슈 모니터링 필수 |

### ✅ Q1/Q2 후속 (2026-05-02 완료)

| # | 항목 | 결과 |
|---|---|---|
| 4 | ~~`app/visit/*`, `lib/context.ts`, `lib/types.ts` dead branch 격리~~ | ✅ 완료. 모두 active 코드 의존 0건 확인 → 통째로 삭제 (`app/home-page-client.tsx`, `app/visit/`, `app/api/visit/`, `lib/context.ts`, `lib/types.ts`) |
| 5 | ~~`supabase/schema.sql` → `docs/SCHEMA_V2_DRAFT.md` 격리~~ | ✅ 완료. 헤더에 "운영 DB 미적용 / 실행 시 충돌 경고" 명시. SQL 코드블록으로 감쌈 |

### 🟢 보안/안정성 deferral (시점 명시)

| # | 항목 | 시점 |
|---|---|---|
| 6 | `/api/cron/embed-new` 배치 — utterance INSERT 시 동기 hook 실패한 경우 누락분 백필 | Phase 2 진입 시 |
| 7 | `/api/device/next-prompt`의 photo caption/people_in_photo 길이 캡 | Phase 1 진입 직전 |
| 8 | `/api/llm/respond`의 `${transcript}` escape 보강 | Phase 1 진입 직전 |
| 9 | `utterance.meta.transcript` 신뢰 모델 — 클라이언트가 임의 transcript 보낼 수 있음 | Phase 1 디바이스 키오스크화와 묶어서 |

### 🔵 디자인 결정 보류 (사용자 답 대기)

| # | 항목 |
|---|---|
| 10 | MOT 헤더 브랜드 노출: keep / remove / 더 작게 |
| 11 | VuMeter `active` 조건: `recording`만 / 현재 그대로 (recording + speaking) |

---

_v2 / 2026-05-02 / Sprint 0 종결 + Phase 1 진입 큐 추가_
