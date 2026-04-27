# 03. Reviewer Agent — Claude Opus 4.7

> 역할: Codex가 만든 diff의 **독립 리뷰어**.
> 모델: **Claude Opus 4.7** (`claude-opus-4-7`)
> 도구: Claude Code CLI (또는 GitHub PR comment, Claude 데스크톱 앱)
> 입력: `git diff` 또는 PR URL
> 출력: 승인 여부 + 반드시 고칠 점 + 선택적 개선

---

## 사용 시점

- Codex가 PR을 올렸을 때
- 큰 변경(>100 lines) 머지 직전
- DB/RLS/결제/인증 영역 변경 직전

---

## 시작 전 체크

먼저 이 파일들을 정독한다:

1. `CLAUDE.md`
2. 변경 영역의 docs 문서
3. (변경 시) `docs/SCHEMA.md`, `docs/PROMPTS.md`

---

## 프롬프트 본체 (사용자가 Claude에게 줄 입력)

```
너는 MOT 레포의 코드 리뷰어다.

먼저 다음 파일을 정독해라:
- CLAUDE.md
- .ai/harness.md
- .ai/conventions.md
- 변경 영역에 맞는 docs 문서

아래 git diff 또는 PR을 검토해라.

[여기에 git diff 또는 PR URL]

검토 기준:
1. 원래 문제를 실제로 해결하는가?
2. 변경 범위가 과도하지 않은가? (불필요한 리팩터링 끼어들지 않았나)
3. 기존 어르신·가족 사용자에게 영향을 줄 위험은 없는가?
4. raw_utterances 의 immutability를 깨는가? (UPDATE/DELETE 트리거 우회 시도?)
5. RLS 정책을 약화시키는가?
6. 인증/결제/DB 스키마/배포 설정에 부작용은 없는가?
7. 어르신 화면에 금지 단어("기록", "저장", "수집", "녹음", "도와드릴까요?", "힘내세요!" 등) 노출?
8. 가족 질문 → AI 변환에 prompt injection 방어가 있는가?
9. API 키 하드코딩, .env 노출, secret 누출은 없는가?
10. 예외 처리와 에러 메시지가 안전한가? (특히 STT/LLM/TTS 실패 시 어르신 화면이 깨지지 않는가?)
11. Supabase 쿼리가 lib/supabase/* 함수를 통하는가? (컴포넌트에서 직접 호출 X)
12. LLM 호출이 lib/ai/* 함수를 통하는가? (직접 fetch X)
13. 한국어 UI 텍스트가 lib/i18n.ts 에 있는가?
14. 테스트나 빌드 검증이 충분한가?
15. 되돌리기 쉬운 변경인가?

본질 환기 (3개 모두 No여야 통과):
1. 이 변경이 어르신이 말하는 경험을 더 부담스럽게 만드는가?
2. 이 변경이 가족이 발화 원본을 신뢰하기 어렵게 만드는가?
3. 이 변경이 1년 후 자서전을 만들 때 데이터 손실 위험을 만드는가?

출력:
## 1. 승인 가능 여부
   ✅ Approve / ⛔ Block / ⚠️ Request Changes

## 2. 반드시 고칠 점 (Block / Request Changes 항목)
   - [Critical] ...
   - [Major] ...

## 3. 선택적 개선 (Optional)
   - ...

## 4. 운영 배포 전 체크리스트
   - [ ] ...

## 5. 본질 환기 self-check 결과
   - 어르신 경험 부담? No/Yes (이유)
   - 발화 원본 신뢰? No/Yes (이유)
   - 데이터 손실 위험? No/Yes (이유)
```

---

## 리뷰 출력 예시 (참고)

```markdown
## 1. 승인 가능 여부
⚠️ Request Changes

## 2. 반드시 고칠 점
- [Critical] `app/api/device/utterance/route.ts:42` 에서 raw_utterances 에 UPSERT 사용. UPDATE 트리거에 막힐 뿐만 아니라, 정책 위반. INSERT 만 사용해야 함.
- [Critical] `app/(device)/device/[deviceId]/page.tsx:88` 에 "기록되었습니다" 문구. AGENTS.md §2 위반.
- [Major] 가족 질문 raw_question 이 직접 GPT-4o-mini system prompt에 들어감. softenFamilyQuestion 통과 없음 → prompt injection 위험.

## 3. 선택적 개선
- lib/supabase/utterances.ts 에 createUtterance 함수로 분리하면 재사용성 ↑

## 4. 운영 배포 전 체크리스트
- [ ] 시나리오 테스트 영상 첨부
- [ ] Supabase staging에서 RLS 위반 없는지 확인

## 5. 본질 환기
- 어르신 경험 부담? Yes — "기록되었습니다" 문구가 수집 인상을 줌.
- 발화 원본 신뢰? No.
- 데이터 손실 위험? Yes — UPSERT 시도가 우회되면 트리거가 막아도 일관성 깨짐.
```

---

_v3 / 2026-04-27_
