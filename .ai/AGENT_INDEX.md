# AGENT_INDEX.md — MOT 에이전트 카탈로그

> 어떤 에이전트를 언제 부르는가의 단일 진실원(single source of truth).

---

## 에이전트 매트릭스

| # | 에이전트 | 모델 | 도구 | 사용 시점 | 파일 |
|---|---|---|---|---|---|
| 01 | **Architect** | Claude Opus 4.7 | Claude Code | 신규 기능, 리팩터링, DB 변경, UX 영향 | `agent-prompts/01_architect_claude.md` |
| 02 | **Executor** | GPT-5.5 in Codex | Codex App | Architect 계획 실행 | `agent-prompts/02_executor_codex.md` |
| 03 | **Reviewer** | Claude Opus 4.7 | Claude Code | Codex diff 독립 리뷰 | `agent-prompts/03_reviewer_claude.md` |
| 04 | **Bugfix** | GPT-5.5 in Codex | Codex App | 운영 장애, 긴급 버그 | `agent-prompts/04_bugfix_codex.md` |
| 05 | **Release Check** | GPT-5.5 in Codex | Codex App | Vercel 배포 직전 점검 | `agent-prompts/05_release_check_codex.md` |
| 06 | **Sprint 0 Initializer** | GPT-5.5 in Codex | Codex App | Sprint 0 (T1~T8) 진행 | `agent-prompts/06_sprint0_codex.md` |
| 07 | **Prompt Engineer** | Claude Opus 4.7 | Claude Code | LLM 프롬프트 튜닝 | `agent-prompts/07_prompt_engineer_claude.md` |
| 08 | **Elder UX Guardian** | Claude Opus 4.7 | Claude Code | 어르신 화면 변경 거부권자 | `agent-prompts/08_elder_ux_guardian_claude.md` |

---

## 표준 워크플로우

### A. 신규 기능 / 리팩터링

```
사용자 → 01 Architect (Claude Opus 4.7)
       → 출력: Execution Steps for Codex
       → 02 Executor (GPT-5.5)
       → 출력: diff + 검증 결과
       → 03 Reviewer (Claude Opus 4.7)
       → 출력: Approve / Block / Request Changes
       → (Block 시) 02 Executor 로 다시
       → 머지 직전: 05 Release Check (GPT-5.5)
       → 머지
```

### B. 운영 장애

```
알람 → 04 Bugfix (GPT-5.5) — 직접 진입
     → 출력: 최소 수정 + 검증
     → 03 Reviewer (Claude Opus 4.7) — 머지 전 짧은 리뷰
     → hotfix 머지
```

### C. 어르신 화면 / LLM 응답 변경

```
사용자 → 01 Architect (필요할 때)
       → 02 Executor
       → 08 Elder UX Guardian (필수, 거부권 보유)
       → ✅ 통과 시에만 다음 단계
       → 03 Reviewer
       → 머지
```

### D. LLM 프롬프트 튜닝

```
관찰된 문제 / 새 산출물 요청 → 07 Prompt Engineer (Claude Opus 4.7)
                              → 출력: 변경 제안 + before/after
                              → 02 Executor (lib/ai/prompts.ts 적용)
                              → 08 Elder UX Guardian (응답 톤 검수)
                              → 머지
```

### E. Sprint 0 (현재)

```
06 Sprint 0 Initializer (GPT-5.5) — T1 부터 T8 까지 순서대로
  T2 적용 후 한 번 03 Reviewer 로 RLS 정책 확인
  T8 DoD 시나리오 통과 → Sprint 0 완료
```

---

## 모델 선택 원칙

| 작업 성격 | 모델 |
|---|---|
| 깊은 추론 / 설계 / 위험 분석 | Claude Opus 4.7 |
| 코드 수정 / 빌드 / 디버깅 | GPT-5.5 in Codex |
| 빠른 단발 리뷰 | Claude Sonnet 4.6 (선택) |
| 인터넷 리서치 + 코드 양방향 | GPT-5.5 in Codex |

**원칙**: 한 번에 한 모델만. Claude가 출력한 계획을 Codex가 받아 실행. Codex가 만든 diff를 Claude가 리뷰. 같은 작업을 두 모델이 동시에 만지지 않는다.

---

## 사용자(이지형)가 자주 쓸 한 줄 명령

```text
# 신규 기능 시작
"01 Architect — [기능 설명]"

# Architect 출력 받은 뒤
"02 Executor — 위 계획대로 실행"

# Codex 끝난 뒤
"03 Reviewer — git diff 리뷰"

# 운영 장애
"04 Bugfix — [증상]"

# 배포 직전
"05 Release Check"

# 어르신 화면 변경 시 필수
"08 Elder UX Guardian — 이 diff 검수"
```

---

_v3 / 2026-04-27_
