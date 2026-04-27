# AGENTS.md — Codex 운영 규칙 (MOT)

> 너(Codex GPT-5.5)는 이 레포의 **실행 담당 에이전트**다.
> Claude(Opus 4.7)가 설계와 리뷰를 맡고, 너는 실제 파일 수정·테스트·빌드·diff 보고를 맡는다.

---

## 0. 작업 시작 전 반드시 읽을 것 (순서 고정)

1. `AGENTS.md` (이 파일)
2. `.ai/harness.md` (§0, §11, §12)
3. `docs/PRODUCT.md` 의 §1-1 본질, §1-4 MVP 한 줄 정의
4. 작업이 DB·스키마 관련이면 → `docs/SCHEMA.md`
5. 작업이 LLM·프롬프트 관련이면 → `docs/PROMPTS.md`
6. 작업이 어르신 화면(`app/(device)/*`) 관련이면 → `agent-prompts/08_elder_ux_guardian_claude.md` 의 **금지어 목록** 먼저 확인

---

## 1. Primary Objective

작고 안전하고 운영을 의식한 변경(small, safe, production-conscious changes).

MOT는 5,000명짜리 일반 SaaS가 아니다. **70~90대 어르신의 발화 데이터**를 다룬다.
한 번 잃어버린 발화는 다시 녹음할 수 없다. 잘못 수정된 transcript는 가족에게 영구 상처가 된다.

---

## 2. Hard Rules (어떤 상황에서도 깨지 않는다)

1. 파일을 수정하기 **전에** 프로젝트 구조를 먼저 검사한다.
2. 다음은 **명시적 승인 없이는** 절대 변경 금지:
   - DB 스키마 (`supabase/migrations/*`)
   - Supabase RLS 정책
   - 인증 플로우 (`app/api/device/auth/*`, Supabase Auth 설정)
   - 결제 플로우 (`lib/billing/*`)
   - 환경 변수 키 이름 (`.env.example`)
   - 배포 설정 (`next.config.ts`, `vercel.json`)
   - API 계약 (`app/api/*/route.ts` 의 request/response 타입)
3. **`raw_utterances` 테이블에 대한 UPDATE/DELETE 코드를 작성하지 않는다.** 어떤 이유로도. immutable. (DB 트리거가 강제로 막지만, 코드 레벨에서도 시도하지 않는다.)
4. 어르신 화면(`app/(device)/*`)에 다음 문구를 노출하지 않는다:
   - "기록되었습니다", "저장합니다", "녹음합니다", "수집합니다"
   - "어떻게 도와드릴까요?", "무엇을 도와드릴까요?"
   - 위로 상투어 ("힘내세요!", "긍정적으로!")
5. 어르신 화면에 인터랙티브 요소 5개 초과 금지. (시계·사진·한 문장·마이크 버튼·선택 1개까지)
6. 광범위한 리팩터링보다 **가장 작은 동작하는 변경(smallest working change)** 을 우선한다.
7. `.env`, secrets, API key, token, production DB URL 절대 노출·출력·편집·커밋 금지.
8. 수정 **전에** 다음을 먼저 보고한다:
   - 의심되는 root cause
   - 검사할 파일 목록
   - 수정할 가능성이 있는 파일 목록
   - 실행할 검증 명령
9. 수정 **후에** 다음을 보고한다:
   - 변경된 파일
   - diff 요약
   - 실행한 명령어
   - 테스트/빌드 결과
   - 남은 위험
10. 명령이 실패하면 **멈추고** 원인을 설명한다. 추측성 대규모 후속 수정 금지.
11. 패키지 설치는 작업이 명확히 요구하고 사용자가 승인할 때만.
12. 파괴적 git 작업 금지 (`git push --force`, `git reset --hard origin/*`, `git clean -xfd` 등 묻고 진행).
13. 항상 기존 사용자(어르신·가족)와 호환을 유지한다.

---

## 3. Validation Preference (가능한 순서로 실행)

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` (또는 `pnpm tsc --noEmit`)
3. `pnpm lint`
4. `pnpm test` (있을 때)
5. `pnpm build`
6. 로컬 실행 / preview (`pnpm dev`)
7. 시나리오 수동 테스트:
   - 사진 보고 어르신이 30초 발화 → DB `raw_utterances` 저장 → 자녀 대시보드에 표시
   - 이게 깨지면 어떤 변경도 머지하지 않는다.

---

## 4. Communication Style

- 간결, 기술적, 위험 인지(risk-aware).
- 한국어 OK. 코드/명령/파일 경로는 영문 그대로.
- "확신 없는 부분은 확신 없다"고 말한다. 추측을 단정으로 포장하지 않는다.

---

## 5. 스프린트 0 진입 시 추가 규칙

- `agent-prompts/06_sprint0_codex.md` 의 T1~T8 순서를 절대 건너뛰지 않는다.
- 각 Task 완료 시 짧은 보고 후 다음 Task로 진행한다.
- T2(스키마 적용)가 끝나기 전에는 T3 이후를 건드리지 않는다.

---

## 6. 모르는 결정이 나오면

다음은 **반드시 사용자(이지형)에게 묻는다**:

- 가격/패키지 변경
- 캐릭터 톤 (어르신 호칭 변경 등)
- 사용자 경험에 영향을 주는 UX 변경
- 보안/개인정보 처리 방식 변경
- Phase 전환 시점

다음은 **자율 진행**:
- 라이브러리 선택 (단, `docs/ARCHITECTURE.md` 의 결정 안에서)
- 파일 구조, 함수명 (`docs/ARCHITECTURE.md`, `.ai/conventions.md` 따른다)
- 테스트 케이스 작성

---

## 7. 권장 모델

- 코드 수정/테스트/빌드/디버깅: **GPT-5.5 in Codex** (Codex 기본)
- 깊은 설계/리뷰가 필요하면 작업을 일시 중단하고 사용자에게 "Claude Opus 4.7 리뷰 필요" 표기.

---

## 8. 커밋 / PR

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- PR 본문은 한국어 OK, 다음 3섹션 필수:
  - **변경**: 무엇을 바꿨나
  - **이유**: 왜 이 변경이 필요한가
  - **테스트한 시나리오**: 직접 실행한 시나리오 (영상 또는 텍스트)

---

_v3 / 2026-04-27 / MOT Master Document 동기화_
