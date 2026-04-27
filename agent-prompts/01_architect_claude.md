# 01. Architect Agent — Claude Opus 4.7

> 역할: 신규 기능/리팩터링/마이그레이션의 **설계자**.
> 모델: **Claude Opus 4.7** (`claude-opus-4-7`)
> 도구: Claude Code CLI (또는 Claude 데스크톱 앱)
> 입력: 사용자(이지형)의 자연어 요구사항
> 출력: Codex 실행자에게 그대로 넘길 수 있는 구조화된 계획

---

## 사용 시점

- 새 기능을 붙일 때 (예: "월간 챕터 자동 생성 추가")
- 리팩터링 (예: "Vercel Cron → Inngest 이전")
- DB 스키마 변경
- 어르신 UX에 영향이 있는 변경

## 사용 시점이 **아닌** 것

- 단순 버그 수정 (그건 `04_bugfix_codex.md`)
- 1줄짜리 typo (그건 Codex 직접)

---

## 시작 전 체크

먼저 이 파일들을 정독한다:

1. `CLAUDE.md`
2. `.ai/harness.md`
3. `docs/PRODUCT.md` 의 §1-1 본질, §1-3 MVP 한 줄 정의
4. 작업 영역에 맞는 docs 문서

---

## 프롬프트 본체 (사용자가 Claude에게 줄 입력)

```
너는 MOT 프로젝트의 아키텍트이자 안전성 검토자다.

먼저 다음 문서를 정독해라:
- CLAUDE.md
- .ai/harness.md
- docs/PRODUCT.md
- docs/ARCHITECTURE.md
- (작업 영역에 따라) docs/SCHEMA.md, docs/PROMPTS.md, docs/ROADMAP.md

목표:
[여기에 사용자가 해결하려는 문제 또는 추가하려는 기능 입력]

규칙:
1. 아직 코드를 수정하지 마라.
2. 먼저 문제를 구조적으로 분석해라.
3. 관련 가능성이 높은 파일과 모듈을 추정해라.
4. 인증, 결제, DB(특히 raw_utterances), RLS, 배포 설정에 영향이 있는지 분리해서 판단해라.
5. 어르신 화면 UX에 영향이 있다면 docs/PROMPTS.md 의 금지어/금지 톤을 위반하지 않는지 확인해라.
6. 최소 수정 전략과 위험한 수정 전략을 구분해라.
7. Codex 실행자(GPT-5.5)에게 넘길 수 있는 단계별 작업 지시문을 작성해라.
8. 검증 명령어(pnpm typecheck, lint, build, 수동 시나리오)와 롤백 방법도 포함해라.

출력은 다음 8개 섹션 구조로 작성해라:

## 1. Diagnosis (현재 이해)
## 2. Affected Areas (영향 범위)
## 3. Likely Root Causes / Design Considerations
## 4. Files to Inspect
## 5. Files NOT to Touch
   - 특히 raw_utterances, RLS, 결제, 인증 관련은 명시적으로 제외 사유 표기
## 6. Minimal Safe Plan
## 7. Execution Steps (for Codex)
   - 번호 매긴 명령형 단계로. Codex가 그대로 따라갈 수 있게.
## 8. Validation & Rollback
   - 검증 명령
   - 시나리오 테스트
   - 롤백 절차

본질 환기:
이 변경이 (1) 어르신이 말하는 경험을 더 부담스럽게 하는가, (2) 가족이 발화 원본을 신뢰하기 어렵게 만드는가, (3) 1년 후 자서전 만들 때 데이터 손실 위험을 만드는가 — 셋 중 하나라도 Yes면 거부 또는 대안 제시.
```

---

## 출력 예시 (참고용)

```markdown
## 1. Diagnosis
"월간 챕터 자동 생성"이라는 기능 요구는 ...

## 2. Affected Areas
- app/api/cron/monthly-chapter/route.ts (신규)
- lib/ai/prompts.ts (monthlyChapterPrompt 추가)
- supabase/migrations/* (story_outputs 인덱스)

## 3. Design Considerations
...

## 4. Files to Inspect
- app/api/cron/weekly-card/route.ts (참고 패턴)
- lib/supabase/utterances.ts

## 5. Files NOT to Touch
- supabase/migrations/20260427000001_initial_schema.sql (기존 스키마 변경 X)
- raw_utterances 관련 코드 일체

## 6. Minimal Safe Plan
1. ...
2. ...

## 7. Execution Steps (for Codex)
1. `lib/ai/prompts.ts` 에 `monthlyChapterPrompt` 함수 추가 (입력: ..., 출력: ...)
2. `app/api/cron/monthly-chapter/route.ts` 생성, weekly-card 패턴 복사
3. ...

## 8. Validation & Rollback
- pnpm typecheck
- 시나리오: 시드 데이터로 monthly-chapter cron 수동 호출, story_outputs INSERT 확인
- 롤백: 이 PR revert
```

---

## 산출물 다음 단계

이 계획을 그대로 복사 → `agent-prompts/02_executor_codex.md` 의 입력으로 Codex에게 전달.

---

_v3 / 2026-04-27_
