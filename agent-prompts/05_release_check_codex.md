# 05. Release Check Agent — Codex GPT-5.5

> 역할: Vercel 배포 전 마지막 점검.
> 모델: **GPT-5.5 in Codex** (`gpt-5.5`)
> 도구: Codex Windows 앱 (또는 Codex CLI)
> 입력: 현재 main 브랜치 상태 또는 머지 예정 PR 목록
> 출력: 배포 가능/보류 결정 + 모니터링 항목

---

## 사용 시점

- `main` 으로 머지 직전
- Vercel production 배포 직전
- 큰 마이그레이션 적용 직전

---

## 프롬프트 본체

```
배포 전 릴리즈 점검을 수행해라.

먼저 다음을 정독해라:
- AGENTS.md
- .ai/harness.md
- docs/SCHEMA.md (DB 변경이 있을 때)

확인 항목 (모두 체크):

1. git status 가 깨끗한가? 미커밋 변경 없는가?
   → `git status` 실행

2. 변경 파일이 의도한 범위 안인가?
   → `git diff origin/main..HEAD --stat`
   → 의도하지 않은 파일 변경 (예: .env 우연 추가, lockfile 광범위 변경) 없는지 확인

3. .env 또는 secret이 노출되지 않았는가?
   → `git diff origin/main..HEAD | grep -iE 'sk-|api[_-]?key|secret|token'` 결과 검토

4. package.json / package-lock 변경이 정당한가?
   → 새 의존성이 필요한 작업이었는지 PR 설명과 일치하는지

5. typecheck / lint / build 가 모두 성공하는가?
   - pnpm typecheck → ✅
   - pnpm lint → ✅
   - pnpm build → ✅

6. 핵심 기능 시나리오가 살아있는가?
   - 어르신 디바이스: 사진 + 한 문장 + 마이크 → 발화 → DB 저장
   - 자녀 대시보드: 로그인 → 발화 목록 → 사진 업로드 → 가족 질문 입력
   - (해당 시) 주간 카드 cron 수동 실행 → story_outputs INSERT

7. DB 마이그레이션이 있는가?
   - 있다면: staging Supabase에서 적용 검증 완료?
   - raw_utterances 트리거 / RLS 정책 영향 없음?

8. 새 환경 변수가 추가됐는가?
   - 있다면: Vercel Project Settings 에 추가 완료?
   - lib/env.ts zod 스키마 업데이트?

9. Vercel Cron 일정이 변경됐는가?
   - vercel.json 의 crons 섹션 확인

10. 어르신 화면 금지어 회귀 검사:
    - `grep -rE '(기록되었습니다|저장합니다|녹음합니다|수집합니다|도와드릴까요|힘내세요)' app/(device)`
    - 결과 0건이어야 함

11. RLS / Storage 정책 변경:
    - 변경 있으면 service_role 키 노출 경로 재확인

12. 롤백 방법이 명확한가?
    - 코드: 직전 main 커밋 hash
    - 마이그레이션: 다운 마이그레이션 또는 수동 롤백 SQL
    - Vercel: previous deployment promote

출력:
## 1. 종합 판정
   ✅ 배포 가능 / ⛔ 배포 보류 / ⚠️ 조건부

## 2. 보류 사유 (보류일 때)
   - ...

## 3. 필수 수정 (배포 전)
   - ...

## 4. 배포 후 모니터링 항목
   - 다음 30분: Vercel 함수 에러율
   - 다음 24시간: Supabase RLS 위반 로그, raw_utterances 일일 INSERT 추세
   - 다음 1주: 어르신 발화 누적 수, 자녀 대시보드 활성

## 5. 롤백 절차
   - 직전 안전 커밋: <hash>
   - Vercel: Deployments → <previous> → Promote
   - DB: <up/down 또는 수동>
```

---

## 자주 빠뜨리는 항목

- **Vercel 환경 변수 동기화** — 코드는 push 됐는데 Vercel 콘솔에 새 키 미추가 → 런타임 에러
- **카카오 알림톡 템플릿 승인** — 새 템플릿 ID는 Kakao Business에 사전 승인 필요 (수일 걸림)
- **Storage CORS** — 새 Storage 버킷 생성 시 CORS 미설정 → 디바이스에서 음성 다운로드 실패
- **시간대** — Vercel Cron은 UTC. KST 21시 cron 은 cron `0 12 * * 0`

---

_v3 / 2026-04-27_
