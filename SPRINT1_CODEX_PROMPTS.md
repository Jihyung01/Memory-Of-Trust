# MOT Sprint 1 — Codex 실행 프롬프트

> 각 작업(S1-T1 ~ S1-T4)을 Codex에 복사-붙여넣기로 넘기면 됩니다.
> 순서: T2 → T3 → T4 → T1 (T1은 디자인이라 독립적, T2~T4는 의존성 있음)

---

## 현재 코드베이스 상태 요약 (Codex 공통 맥락)

```
프레임워크: Next.js 15.5.15 (App Router) + TypeScript + Tailwind CSS
DB: Supabase (Postgres + RLS + Storage)
인증: HMAC-SHA256 디바이스 토큰 (어르신), Magic Link (가족)
AI: OpenAI GPT-4o-mini (대화), Whisper (STT), tts-1 (TTS)
환경변수: lib/env.ts (Zod 검증, env.OPENAI_API_KEY 등)

주요 파일:
- lib/ai/prompts.ts          — 모든 LLM 프롬프트 (캐릭터, 8축 추출, 주간카드, 월간챕터)
- lib/ai/openai-tts.ts       — OpenAI TTS
- lib/supabase/server.ts      — Supabase service_role 헬퍼
- lib/supabase/family.ts      — 가족 대시보드 쿼리 헬퍼
- lib/supabase/client.ts      — 브라우저 anon 클라이언트
- lib/env.ts                  — 환경변수 검증
- lib/i18n.ts                 — 한국어 UI 텍스트
- lib/voice/recorder.ts       — 브라우저 녹음 (VAD 무음감지)

API 라우트:
- app/api/stt/route.ts        — Whisper STT + 한국어 환각 필터
- app/api/tts/route.ts        — OpenAI TTS → mp3
- app/api/llm/respond/route.ts — 캐릭터 응답 생성 (1턴)
- app/api/device/next-prompt/  — 다음 프롬프트 (사진 트리거)
- app/api/device/utterance/    — 발화 저장 (raw_utterances INSERT)

UI 컴포넌트:
- app/(device)/device/[deviceId]/components/ — 어르신 화면 (레트로 라디오 UI)
- app/(family)/family/[elderId]/            — 가족 대시보드
- app/(family)/family/login/                — 매직링크 로그인

DB 테이블 (supabase/migrations/20260427000001_initial_schema.sql):
  elders, family_members, devices, photos, family_questions, prompts,
  raw_utterances (immutable), timeline_events, entities, themes,
  emotion_layer, unresolved_queue, sensory_details, verifications,
  memory_candidates, story_outputs, subscriptions

디자인 시스템:
  globals.css에 CSS 변수 정의 (--radio-body, --radio-accent 등)
  어르신 화면: 회색 메탈 라디오 컨셉 (다크 그레이 #2a2a2d, 앰버 #ffb43c)
  랜딩 페이지: 크림 배경 #f5f3ef
```

---

## S1-T1: 가족 대시보드 UI 개선

### Codex 프롬프트

```
## 작업: 가족 대시보드 UI를 레트로 따뜻한 톤으로 리디자인

### 맥락
현재 가족 대시보드(app/(family)/family/[elderId]/FamilyDashboardClient.tsx)는
기본적인 목록 형태(bg-stone-50, 흰색 카드)입니다.
어르신 디바이스 화면은 이미 회색 레트로 라디오 UI로 리디자인되었고,
가족 대시보드도 같은 디자인 언어로 통일해야 합니다.

### 디자인 방향
- 밝은 크림 톤 배경 (#f5f3ef) — 랜딩 페이지와 동일
- 카드: #fff 배경 + #e0dbd2 보더 + rounded-2xl
- 강조색: 앰버 #ffb43c (통계, 아이콘)
- 다크 패널: #2a2a2d (헤더, 통계 바)
- 텍스트: #2a2a2d (주), #8a8880 (보조), #6a6a6e (중간)
- 아이콘: SVG stroke 스타일, #6a6a6e
- 원형 아이콘 배경: radial-gradient(circle, #f0ece6, #e0dbd2)

### 구현 범위
1. FamilyDashboardClient.tsx 전면 리디자인:
   - 상단 네비게이션 바 (MOT 로고 + 어르신 이름 + 로그아웃)
   - 요약 통계 카드 (총 발화 수, 이번 주 발화 수, 마지막 활동 시간)
   - 발화 목록: 카드 스타일, 날짜 + transcript + 감정 힌트
   - 하단 탭: 홈 / 사진 / 질문하기 / 이번 주 이야기

2. 사진 업로드 페이지(PhotosPageClient.tsx)도 같은 톤으로 수정

3. ko 객체(lib/i18n.ts)에 있는 텍스트 그대로 사용

### 금지 사항
- 새로운 npm 패키지 설치 금지
- lib/i18n.ts의 텍스트 변경 금지
- API 라우트 변경 금지
- globals.css의 CSS 변수(--radio-*) 활용할 것

### 자체 검증
- npx tsc --noEmit --skipLibCheck 에러 없을 것
- 브라우저에서 /family/{elderId} 접속 시 정상 렌더링
```

---

## S1-T2: 다중 턴 대화

### Codex 프롬프트

```
## 작업: 어르신 음성 대화를 다중 턴으로 확장

### 맥락
현재 대화는 1턴(어르신 말→AI 응답)으로만 동작합니다.
app/api/llm/respond/route.ts에서 messages 배열에 system + prompt + 현재 발화만 넣고 있습니다.
이전 대화 맥락이 없어서 AI가 "지난번에 말씀하신~" 같은 연속 대화를 못 합니다.

### 구현 요구사항

1. **대화 이력 조회 API 또는 함수 추가**
   - lib/supabase/server.ts에 `fetchRecentUtterancesForConversation` 함수 추가
   - elder_id로 최근 N개(기본 5개) raw_utterances를 시간순으로 조회
   - 반환: { transcript, started_at, created_at }[]

2. **app/api/llm/respond/route.ts 수정**
   - 기존: system + prompt_text(assistant) + 현재 transcript(user)
   - 변경: system + 최근 5개 발화를 user/assistant 교대로 구성 + 현재 transcript
   - 이전 발화의 AI 응답은 DB에 없으므로, 이전 발화는 user 역할로만 추가
   - 형식: `[{role:"system"}, ...이전발화들{role:"user"}, {role:"assistant", content:prompt_text}, {role:"user", content:현재발화}]`
   - max_tokens: 150 유지 (어르신에게 짧게 응답)

3. **AI 응답도 DB에 저장 (선택적)**
   - raw_utterances는 immutable이라 여기에 AI 응답을 넣으면 안 됨
   - 대안: prompts 테이블에 AI 응답을 기록 (prompt_type: 'follow_up', prompt_text: 응답 텍스트)
   - llm/respond에서 응답 생성 후 prompts 테이블에 INSERT
   - 이러면 다음 턴에서 이전 AI 응답도 messages에 포함 가능

4. **DevicePageClient.tsx는 수정 불필요**
   - 이미 prompt_text를 llm/respond에 보내고 있음
   - 백엔드에서 이력을 가져오므로 프론트 변경 없음

### 기술 제약
- env.OPENAI_RESPONSE_MODEL (gpt-4o-mini) 사용
- messages 배열 총 토큰이 너무 크면 안 됨 — 최근 5개 발화로 제한
- raw_utterances 테이블은 UPDATE/DELETE 트리거로 보호됨 — INSERT만 가능
- ELDER_CHARACTER_SYSTEM_PROMPT는 lib/ai/prompts.ts에 있음, 수정 금지

### 파일 수정 목록
- lib/supabase/server.ts (함수 추가)
- app/api/llm/respond/route.ts (이력 반영)

### 자체 검증
- npx tsc --noEmit --skipLibCheck 에러 없을 것
- 연속 대화 시 AI가 이전 발화를 인지하는지 확인
  (예: 첫 턴 "결혼식 이야기" → 두 번째 턴에서 AI가 "아까 결혼식 말씀하셨는데~")
```

---

## S1-T3: 기억 추출 파이프라인

### Codex 프롬프트

```
## 작업: raw_utterances에서 8축 데이터를 자동 추출하는 배치 API 구현

### 맥락
어르신이 대화하면 raw_utterances에 transcript가 쌓입니다.
이 transcript에서 8축 데이터(timeline_events, entities, themes, emotion_layer,
unresolved_queue, sensory_details, verifications, memory_candidates)를
LLM으로 추출해서 각 테이블에 INSERT하는 파이프라인이 필요합니다.

프롬프트는 이미 lib/ai/prompts.ts의 extractAxesPrompt()에 완성되어 있습니다.
DB 테이블도 supabase/migrations/20260427000001_initial_schema.sql에 이미 존재합니다.

### 구현 요구사항

1. **배치 추출 API 생성: app/api/batch/extract/route.ts**
   - POST 요청, body: { elder_id: string, limit?: number }
   - 헤더: Authorization: Bearer {CRON_SECRET} (env.CRON_SECRET로 인증)
   - 흐름:
     a. raw_utterances에서 아직 추출 안 된 발화를 가져옴
        → "아직 추출 안 된" 판별: emotion_layer에 해당 utterance_id가 없는 것
        → 쿼리: SELECT ru.* FROM raw_utterances ru
                LEFT JOIN emotion_layer el ON el.utterance_id = ru.id
                WHERE ru.elder_id = $1 AND el.id IS NULL
                ORDER BY ru.started_at ASC LIMIT $2
     b. 각 발화에 대해 extractAxesPrompt() 호출 → GPT-4o (env.OPENAI_BATCH_MODEL)
     c. JSON 응답 파싱
     d. 각 축 테이블에 INSERT (service_role 클라이언트 사용)

2. **lib/supabase/server.ts에 INSERT 헬퍼 추가**
   ```typescript
   insertTimelineEvent(input: {...}): Promise<void>
   insertEntity(input: {...}): Promise<void>
   insertTheme(input: {...}): Promise<void>
   insertEmotionLayer(input: {...}): Promise<void>
   insertUnresolvedItem(input: {...}): Promise<void>
   insertSensoryDetail(input: {...}): Promise<void>
   insertMemoryCandidate(input: {...}): Promise<void>
   ```
   - 모든 INSERT에 elder_id, utterance_id 포함
   - entities는 같은 이름이 있으면 mention_count 증가 (UPSERT)

3. **에러 처리**
   - LLM 응답이 유효한 JSON이 아니면 해당 발화 건너뜀 (로그만)
   - 개별 축 INSERT 실패해도 다른 축은 계속 진행
   - 전체 처리 결과 반환: { processed: number, failed: number, errors: string[] }

### 기술 제약
- extractAxesPrompt()는 lib/ai/prompts.ts에 이미 있음 — 수정 금지
- env.OPENAI_BATCH_MODEL (gpt-4o) 사용 — 추출 품질이 중요하므로 4o-mini 아닌 4o
- env.CRON_SECRET으로 인증 — 가족/디바이스 인증이 아님
- raw_utterances는 immutable — SELECT만 가능
- GRANT는 이미 설정됨 (service_role에 모든 테이블 INSERT 권한 있음)

### 파일 생성/수정 목록
- app/api/batch/extract/route.ts (신규)
- lib/supabase/server.ts (INSERT 헬퍼 추가)

### 자체 검증
- npx tsc --noEmit --skipLibCheck 에러 없을 것
- curl로 테스트:
  curl -X POST http://localhost:3000/api/batch/extract \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"elder_id":"00000000-0000-0000-0000-000000000001"}'
- raw_utterances에 데이터가 있다면, 8축 테이블에 데이터가 INSERT되어야 함
```

---

## S1-T4: 주간 카드 / 월간 챕터 생성

### Codex 프롬프트

```
## 작업: 주간 카드와 월간 챕터를 생성하는 배치 API 구현

### 맥락
S1-T3에서 8축 데이터가 추출되면, 이를 바탕으로 가족에게 전달할
주간 카드(weekly_card)와 월간 챕터(monthly_chapter)를 생성합니다.
프롬프트는 lib/ai/prompts.ts의 weeklyCardPrompt()와 monthlyChapterPrompt()에
이미 완성되어 있습니다.
결과는 story_outputs 테이블에 저장됩니다.

### 의존성
- S1-T3 (기억 추출 파이프라인)이 먼저 완료되어야 합니다.
- timeline_events, entities, themes, unresolved_queue 테이블에 데이터가 있어야 합니다.

### 구현 요구사항

1. **주간 카드 API: app/api/batch/weekly-card/route.ts**
   - POST, body: { elder_id: string, week_start?: string, week_end?: string }
   - 인증: Authorization: Bearer {CRON_SECRET}
   - 흐름:
     a. 해당 주의 raw_utterances 조회 (started_at 기준)
     b. 해당 주의 unresolved_queue 조회 (status='open')
     c. weeklyCardPrompt() 호출 → GPT-4o
     d. story_outputs에 INSERT:
        - output_type: 'weekly_card'
        - title: "YYYY년 M월 W주차"
        - content: LLM 응답 (Markdown)
        - source_utterance_ids: 사용된 발화 ID 배열
        - generated_by_model: env.OPENAI_BATCH_MODEL
   - 기본값: week_start/end 없으면 지난 월~일요일

2. **월간 챕터 API: app/api/batch/monthly-chapter/route.ts**
   - POST, body: { elder_id: string, month?: string }
   - 인증: Authorization: Bearer {CRON_SECRET}
   - 흐름:
     a. 해당 월의 raw_utterances 조회
     b. 해당 월의 themes, entities 조회
     c. monthlyChapterPrompt() 호출 → GPT-4o
     d. story_outputs에 INSERT:
        - output_type: 'monthly_chapter'
        - title: "YYYY년 M월"
        - content: LLM 응답 (Markdown)
        - source_utterance_ids, generated_by_model
   - 기본값: month 없으면 지난달

3. **lib/supabase/server.ts에 헬퍼 추가**
   ```typescript
   fetchUtterancesByDateRange(elderId, startDate, endDate): Promise<{...}[]>
   fetchOpenUnresolved(elderId): Promise<{...}[]>
   fetchThemesByElder(elderId): Promise<{...}[]>
   fetchEntitiesByElder(elderId): Promise<{...}[]>
   insertStoryOutput(input: {...}): Promise<{id: string}>
   ```

4. **가족 대시보드에서 조회** (간단하게)
   - lib/supabase/family.ts에 fetchWeeklyCards(), fetchMonthlyChapters() 추가
   - 가족 대시보드(FamilyDashboardClient.tsx)에 탭 또는 섹션으로 표시
     (S1-T1이 완료된 상태라면 해당 UI에 맞춰서, 아니면 간단한 목록으로)

### 기술 제약
- weeklyCardPrompt(), monthlyChapterPrompt()는 lib/ai/prompts.ts에 이미 있음 — 수정 금지
- env.OPENAI_BATCH_MODEL (gpt-4o) 사용
- story_outputs 테이블 스키마:
  id, elder_id, output_type, title, content, delivered_to, delivered_at,
  source_utterance_ids (UUID[]), source_timeline_event_ids (UUID[]),
  generated_by_model, created_at
- GRANT: service_role에 story_outputs INSERT/UPDATE/SELECT 권한 있음
- authenticated에 story_outputs SELECT 권한 있음

### 파일 생성/수정 목록
- app/api/batch/weekly-card/route.ts (신규)
- app/api/batch/monthly-chapter/route.ts (신규)
- lib/supabase/server.ts (헬퍼 추가)
- lib/supabase/family.ts (조회 헬퍼 추가)

### 자체 검증
- npx tsc --noEmit --skipLibCheck 에러 없을 것
- curl로 weekly-card API 호출 → story_outputs에 weekly_card 레코드 생성 확인
- curl로 monthly-chapter API 호출 → story_outputs에 monthly_chapter 레코드 생성 확인
```

---

## 실행 순서 & 체크리스트

| 순서 | 작업 | 의존성 | 예상 시간 |
|------|------|--------|----------|
| 1 | S1-T2 다중 턴 대화 | 없음 | 30분 |
| 2 | S1-T3 기억 추출 파이프라인 | 없음 | 1시간 |
| 3 | S1-T4 주간 카드/월간 챕터 | S1-T3 | 1시간 |
| 4 | S1-T1 가족 대시보드 UI | S1-T4 (조회 기능 필요) | 1시간 |

### 각 작업 완료 후 확인사항
- [ ] `npx tsc --noEmit --skipLibCheck` 타입 에러 없음
- [ ] `npm run dev` 실행 시 컴파일 에러 없음
- [ ] git commit & push 완료

### Claude 아키텍트 리뷰 체크포인트
- S1-T2 완료 후: 다중 턴 대화 품질 확인 (messages 배열 구성 적절한지)
- S1-T3 완료 후: 8축 추출 결과 Supabase에서 확인, JSON 파싱 안정성
- S1-T4 완료 후: 생성된 카드/챕터 내용 품질 확인
- S1-T1 완료 후: Elder UX Guardian 검수 (가족 화면은 SaaS 톤 OK)
