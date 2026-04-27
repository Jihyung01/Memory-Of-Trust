# MOT (Memory Of Trust)

> 라디오처럼 말 걸고, 액자처럼 기억 보여주는 **AI 기억 수집 장치**.
>
> 어르신 거실에 들어간 7인치 태블릿이 매일 사진을 보여주며 부드럽게 말을 건다.
> 그 발화는 영원히 보존되고, 가족에게 주간 카드로 전달된다.
> 1년 후, 그 데이터는 자서전이 된다.

---

## 본질 (절대 잊지 말 것)

> "인간은 죽기 전에 자신의 가치를 남기고 가고 싶어한다. 기억되고 싶어한다."

**자서전 서비스가 아니다.** 인간의 보존 욕구를 충족시키는 서비스다.
자서전은 1차 산출물일 뿐이고, 같은 데이터에서 편지·미래편지·사과집·가치관집·추모영상이 나온다.

- **사용자**: 70~90대 어르신
- **결제자**: 40~60대 자녀 (90% 자녀, 10% 본인)

---

## 빠른 시작

```powershell
# 1. 의존성
pnpm install

# 2. .env.local 설정
copy .env.example .env.local
# 그리고 .env.local 의 값들을 채워라.
# (Supabase URL/키, OpenAI 키, 클로바보이스 키 등)

# 3. Supabase 마이그레이션
# supabase/migrations/20260427000001_initial_schema.sql → SQL Editor 에 붙여넣고 RUN
# supabase/migrations/20260427000002_rls_policies.sql → 같은 방식
# supabase/seed.sql → 시드 데이터

# 4. 타입 생성
pnpm supabase:gen-types

# 5. 개발 서버
pnpm dev
```

---

## 디렉토리 구조

```
mot/
├── AGENTS.md                  # Codex 운영 규칙
├── CLAUDE.md                  # Claude Code 운영 규칙
├── .ai/
│   ├── harness.md             # 에이전트가 가장 먼저 읽는 문서
│   ├── conventions.md         # 코딩 컨벤션
│   └── AGENT_INDEX.md         # 에이전트 카탈로그
├── agent-prompts/             # 역할별 프롬프트 (모델 명시)
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMA.md
│   ├── PROMPTS.md
│   └── ROADMAP.md
├── scripts/                   # Windows 배치 스크립트
├── app/                       # Next.js App Router
├── lib/                       # 공통 라이브러리
│   ├── ai/prompts.ts          # LLM 프롬프트 카탈로그
│   ├── env.ts                 # 환경 변수 검증
│   └── i18n.ts                # 한국어 UI 텍스트
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── public/
└── ...
```

---

## 에이전트 사용법

이 레포는 **Claude Opus 4.7** 과 **GPT-5.5 in Codex** 두 모델을 역할 분담한다.

| 작업 | 1차 | 2차 | 프롬프트 |
|---|---|---|---|
| 신규 기능 설계 | Claude Opus 4.7 | Codex 실행 | `agent-prompts/01_architect_claude.md` |
| 코드 구현 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/02_executor_codex.md` |
| Diff 리뷰 | Claude Opus 4.7 | — | `agent-prompts/03_reviewer_claude.md` |
| 운영 장애 | Codex GPT-5.5 | Claude 리뷰 | `agent-prompts/04_bugfix_codex.md` |
| 배포 직전 | Codex GPT-5.5 | — | `agent-prompts/05_release_check_codex.md` |
| Sprint 0 | Codex GPT-5.5 | — | `agent-prompts/06_sprint0_codex.md` |
| LLM 프롬프트 튜닝 | Claude Opus 4.7 | — | `agent-prompts/07_prompt_engineer_claude.md` |
| 어르신 UX 검수 | Claude Opus 4.7 (거부권 보유) | — | `agent-prompts/08_elder_ux_guardian_claude.md` |

전체 워크플로우는 `.ai/AGENT_INDEX.md` 참조.

---

## Sprint 0 (현재)

**목표**: 1주일 안에 어르신 1명이 사진 보고 한 마디 하면 그게 DB에 저장되고 자녀 대시보드에서 볼 수 있는 최소 루프.

`scripts\sprint0-init.bat` 실행하면 Codex 가 T1~T8을 순서대로 진행한다.

자세한 진행은 `agent-prompts/06_sprint0_codex.md` 와 `.ai/harness.md` §11 참조.

---

## 절대 하지 말 것

1. 어르신 화면에 "기록되었습니다", "저장합니다", "어떻게 도와드릴까요?" 같은 챗봇/수집 언어 ✗
2. `raw_utterances` UPDATE/DELETE 코드 작성 ✗ (DB 트리거가 강제로 막지만, 코드도 시도하지 않는다)
3. 어르신 화면에 인터랙티브 요소 5개 초과 ✗
4. 자체 하드웨어 제작 (Phase 3 이후 OEM 협업으로만)
5. 가족 평가 ("따님이 잘못하셨네요" 류) LLM 응답 ✗
6. API 키 하드코딩 ✗ (반드시 `lib/env.ts` 통해)

자세한 룰은 `AGENTS.md` §2, `CLAUDE.md` §3 참조.

---

## 라이센스 / 상태

Private. v3 — 2026-04-27.
