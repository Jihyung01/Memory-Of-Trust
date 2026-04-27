# MOT Harness — `.ai/harness.md`

> 코딩 에이전트(Claude Code, Codex)가 가장 먼저 읽는 운영 문서.
> Master Document v3의 §0, §11, §12를 통합한 실행용 발췌본이다.
> 제품/아키텍처 배경은 `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` 참조.

---

## §0. Quick Reference

| 항목 | 값 |
|---|---|
| 프로젝트명 | **MOT (Memory Of Trust)** |
| 한 줄 정의 | 라디오처럼 말 걸고, 액자처럼 기억 보여주는 AI 기억 수집 장치 |
| 현재 Phase | **Phase 1 (1인 실험)** |
| 첫 빌드 목표 | 어르신용 PWA + 자녀용 대시보드 + 음성 녹음/STT/저장 루프 |
| 주 언어 | TypeScript (Next.js App Router) |
| 패키지 매니저 | pnpm |
| 배포 | Vercel (웹) + Supabase (DB/Auth/Storage) |
| 디바이스 | 시판 7인치 안드로이드 태블릿 + 키오스크 모드 |
| 사용자 | 어르신 (70~90대) |
| 결제자 | 자녀 (40~60대) |

---

## §0-1. 절대 하지 말 것 (Hard Don'ts)

어떤 상황에서도 깨지 않는다:

1. 어르신 화면에 **"기록되었습니다", "저장합니다", "어떻게 도와드릴까요?"** 같은 챗봇/수집 언어 노출 금지.
2. **`raw_utterances`** 원본 발화 UPDATE/DELETE 금지 (DB 트리거가 강제하지만, 코드도 시도하지 않는다).
3. 어르신용 화면에 **버튼 5개 초과** 금지.
4. 자체 하드웨어 제작 금지 (Phase 3 이후 OEM 협업으로만).
5. 가족 평가 ("따님이 잘못하셨네요" 류) LLM 응답 절대 금지.
6. 의학·법률·재무 조언 응답 절대 금지.
7. 위로 상투어 ("힘내세요!", "긍정적으로!") 절대 금지.
8. API 키 하드코딩 금지. 항상 `lib/env.ts` 통해서만.

---

## §11. Sprint 0 — 첫 작업 (에이전트가 즉시 시작할 것)

### Goal

> 1주일 안에 **어르신 1명이 사진 보고 한 마디 하면 그게 DB에 저장되고 자녀 대시보드에서 볼 수 있는 최소 루프**를 만든다.

### Tasks (순서대로, 건너뛰기 금지)

#### T1. 프로젝트 초기 설정 (반나절)

- [ ] `pnpm create next-app@latest mot --typescript --tailwind --app --src-dir=false`
- [ ] shadcn/ui 초기화: `pnpm dlx shadcn@latest init`
- [ ] `lib/supabase/`, `lib/ai/`, `lib/voice/` 디렉토리 생성
- [ ] `.env.example` 작성 (이 레포의 `.env.example` 그대로 사용)
- [ ] `next.config.ts`에 PWA 설정

#### T2. Supabase 스키마 적용 (1시간)

- [ ] Supabase 프로젝트 생성
- [ ] `supabase/migrations/20260427000001_initial_schema.sql` 실행
- [ ] `supabase/migrations/20260427000002_rls_policies.sql` 실행
- [ ] `pnpm dlx supabase gen types typescript --project-id ... > lib/supabase/types.ts`
- [ ] 시드 데이터(`supabase/seed.sql`) 적용: elder 1명, family_member 1명, photos 5장

#### T3. 디바이스 인증 + 다음 프롬프트 조회 (반나절)

- [ ] `app/api/device/auth/route.ts` — `device_token` → `elder_id` 반환
- [ ] `app/api/device/next-prompt/route.ts` — 가장 최근에 안 보여준 사진 + 첫 발화 프롬프트 반환
- [ ] LLM 호출은 GPT-4o-mini (`lib/ai/openai.ts`)

#### T4. 어르신 디바이스 화면 (1일)

- [ ] `app/(device)/device/[deviceId]/page.tsx`
  - 큰 시계 (좌측 또는 상단)
  - 사진 한 장 (중앙, 큰 사이즈)
  - 한 문장 (사진 아래)
  - 마이크 버튼 (큰, 하단 중앙)
- [ ] PWA fullscreen 모드 강제
- [ ] 폰트 크게 (`text-3xl` 이상)
- [ ] 배경: 종이톤/액자톤 (베이지/우드). 어두운 배경 회피.

#### T5. 음성 녹음 + STT + 저장 (1일)

- [ ] `lib/voice/recorder.ts` — MediaRecorder로 webm/opus 녹음
- [ ] 마이크 버튼 누르면 녹음 시작, 다시 누르면 종료
- [ ] `app/api/stt/route.ts` — Whisper API 호출 (`language: "ko"` 강제)
- [ ] `app/api/device/utterance/route.ts` — Storage 업로드, `raw_utterances` INSERT

#### T6. LLM 응답 + TTS 재생 (1일)

- [ ] `app/api/llm/respond/route.ts` — `lib/ai/prompts.ts` 의 캐릭터 프롬프트 사용
- [ ] `app/api/tts/route.ts` — 클로바보이스 mp3 생성, 임시 URL 반환
- [ ] 디바이스 화면에서 자동 재생

#### T7. 자녀 대시보드 최소 (반나절)

- [ ] Supabase Auth (이메일 매직 링크)
- [ ] `app/(family)/family/[elderId]/page.tsx` — 발화 목록(최근순)
- [ ] `app/(family)/family/[elderId]/photos/page.tsx` — 사진 업로드

#### T8. 1차 동작 확인 (반나절)

- [ ] 본인이 어르신 역할로 시범 발화
- [ ] DB에 `raw_utterance` 저장 확인
- [ ] 자녀 대시보드에서 transcript 표시 확인
- [ ] 응답 음성 자연성 확인 (안 자연스러우면 클로바보이스 `voice_id` 변경)

### Definition of Done (Sprint 0)

- [ ] 사진을 보면서 어르신이 한 마디 하면 → 30초 안에 DB에 영구 저장
- [ ] AI가 부드럽게 한 문장 응답하고 음성으로 재생
- [ ] 자녀가 웹 대시보드에서 transcript 열람

이 3가지가 되면 Sprint 0 완료. **다른 기능(주간 카드 자동화, 가족 질문 업로드, 8축 추출, 결제 등)은 Sprint 1 이후로 미룬다.**

---

## §12. 코딩 에이전트 행동 지침 (Harness Core)

### §12-1. 작업 원칙

1. §11의 Sprint 0를 **순서대로** 처리. 건너뛰기 금지.
2. 한 번에 하나의 Task만, 끝나면 짧은 요약 보고.
3. 모르면 추측하지 말고 **묻는다**. 특히 비즈니스 결정사항 (가격, UX 톤).
4. 컨벤션 충돌 시 §12-2 우선.
5. 개인 의견을 코드에 주입하지 않는다 (특히 어르신 화면 UX).

### §12-2. 코딩 컨벤션

- TypeScript strict mode
- 함수는 동사로 (`fetchUtterance` not `utterance`)
- 컴포넌트 파일명: PascalCase (`PhotoFrame.tsx`)
- 유틸 파일명: kebab-case (`extract-axes.ts`)
- 서버 코드는 `app/api/*/route.ts` 또는 Server Actions
- `'use client'`는 정말 필요한 곳에만
- 환경 변수는 항상 `lib/env.ts`로 한 번 검증해서 export
- Supabase 쿼리는 `lib/supabase/*.ts` 함수로 묶어서 export, 컴포넌트에서 직접 호출 X
- LLM 호출은 항상 `lib/ai/*.ts`의 함수 통해서, 직접 fetch 금지
- 한국어 UI 텍스트는 `lib/i18n.ts`에 모아둠 (i18next는 Phase 3 이후)

### §12-3. 절대 금기 (다시 한 번)

- `raw_utterances` UPDATE 또는 DELETE 코드
- 어르신 화면에 "기록", "저장", "녹음", "수집" 단어 노출
- 어르신 화면에 광고, 추천, 다른 서비스 링크
- 어르신 화면에 5개 초과 인터랙티브 요소
- 자녀 대시보드에서 어르신 발화 원본 수정 (주석/보충은 `verifications` 테이블에)
- API 키 하드코딩 (반드시 `lib/env.ts`)
- 사용자 입력을 직접 LLM에 전달 (가족 질문은 반드시 `softenFamilyQuestion` 통과)

### §12-4. 테스트 전략 (Phase 1)

- unit test 강박 X. 수동 시나리오 테스트가 더 중요.
- 시나리오: "사진 보고 어르신이 30초 발화 → DB 저장 → 자녀 대시보드 표시" — 매 PR마다 직접 실행.
- E2E (Playwright)는 Sprint 2부터.

### §12-5. 커밋/PR 컨벤션

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- PR 본문은 한국어 OK, **변경 / 이유 / 테스트한 시나리오** 3섹션 필수.

### §12-6. 모르는 결정이 나오면 — 묻는다

다음은 반드시 사용자(이지형)에게:

- 가격/패키지 변경
- 캐릭터 톤 (어르신 호칭 등)
- UX에 영향을 주는 변경
- 보안/개인정보 처리 방식
- Phase 전환 시점

기술 결정 (라이브러리, 파일 구조, 함수명)은 §4·§7·§12-2 따라 자율.

---

## 에이전트별 역할 매핑

| 작업 유형 | 1차 담당 | 2차 담당 | 참고 프롬프트 |
|---|---|---|---|
| 신규 기능 설계 | Claude Opus 4.7 | Codex 실행 | `agent-prompts/01_architect_claude.md` |
| 코드 구현 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/02_executor_codex.md` |
| Diff 리뷰 | Claude Opus 4.7 | — | `agent-prompts/03_reviewer_claude.md` |
| 운영 장애 수정 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/04_bugfix_codex.md` |
| 배포 전 점검 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/05_release_check_codex.md` |
| Sprint 0 진행 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/06_sprint0_codex.md` |
| LLM 프롬프트 튜닝 | Claude Opus 4.7 | — | `agent-prompts/07_prompt_engineer_claude.md` |
| 어르신 UX 검수 | Claude Opus 4.7 | — | `agent-prompts/08_elder_ux_guardian_claude.md` |

---

_v3 / 2026-04-27 / Master Document 동기화_
