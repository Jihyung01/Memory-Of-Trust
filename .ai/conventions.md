# `.ai/conventions.md` — MOT 코딩 컨벤션

> 에이전트 둘 다 (Claude, Codex) 이 컨벤션을 따른다. 충돌 시 이 문서가 우선.

---

## 1. 언어 / 도구

- TypeScript **strict mode** (tsconfig `strict: true`)
- Next.js 15+ **App Router** (Pages Router 금지)
- 패키지 매니저 **pnpm** (npm/yarn 금지)
- Node.js 20+
- Tailwind CSS v4 + shadcn/ui

---

## 2. 파일 / 디렉토리 명명

| 종류 | 규칙 | 예시 |
|---|---|---|
| React 컴포넌트 | PascalCase | `PhotoFrame.tsx`, `MicButton.tsx` |
| 유틸/함수 모듈 | kebab-case | `extract-axes.ts`, `soften-question.ts` |
| App Router 라우트 | Next 표준 (소문자) | `app/(device)/device/[deviceId]/page.tsx` |
| API route | `route.ts` | `app/api/stt/route.ts` |
| DB 마이그레이션 | `YYYYMMDDHHMMSS_*.sql` | `20260427000001_initial_schema.sql` |

---

## 3. 함수 / 변수

- 함수는 **동사**로 시작: `fetchUtterance`, `softenFamilyQuestion`, `playResponseAudio`
- 명사 단독 함수 금지: ❌ `utterance()` → ✅ `fetchUtterance()`
- 컴포넌트는 명사 (PascalCase): `PhotoFrame`, `WeeklyCardPreview`
- 불리언은 `is/has/can/should` 접두사: `isRecording`, `hasUnresolvedItems`
- 상수는 `SCREAMING_SNAKE_CASE`: `ELDER_CHARACTER_SYSTEM_PROMPT`

---

## 4. 클라이언트 / 서버 분리

- `'use client'` 는 **정말 필요한 곳에만** (브라우저 API, useState, MediaRecorder 등)
- 서버 코드의 default 위치:
  - 데이터 페칭: Server Component 또는 Server Action
  - 외부 API 호출 (OpenAI, Clova): `app/api/*/route.ts`
- Supabase 클라이언트:
  - 브라우저: `lib/supabase/client.ts`
  - 서버 (Service Role): `lib/supabase/server.ts`
  - **Service Role 키는 절대 클라이언트로 보내지 않는다.**

---

## 5. 환경 변수

- 모든 env는 `lib/env.ts` 에서 zod로 한 번 검증 후 export
- 코드에서 `process.env.OPENAI_API_KEY` 직접 접근 금지 → `import { env } from "@/lib/env"`
- `NEXT_PUBLIC_*` 만 클라이언트 노출, 그 외는 서버 전용

---

## 6. DB 접근

- Supabase 쿼리는 `lib/supabase/*.ts` 함수로 묶는다.
- 컴포넌트나 route handler가 `supabase.from(...)` 직접 호출 금지.
- 예시:

```ts
// lib/supabase/utterances.ts
export async function listUtterancesByElder(elderId: string, limit = 50) { ... }

// app/(family)/family/[elderId]/page.tsx
import { listUtterancesByElder } from "@/lib/supabase/utterances";
```

---

## 7. LLM / AI 호출

- 모든 LLM 호출은 `lib/ai/*.ts` 함수로 캡슐화.
- 컴포넌트나 route handler에서 `fetch("https://api.openai.com/...")` 직접 호출 금지.
- 프롬프트 문자열은 `lib/ai/prompts.ts` 한 곳에서만 관리.
- 모델 이름 하드코딩 금지 → `env.OPENAI_RESPONSE_MODEL` 같이 env 통해.

---

## 8. 한국어 UI 텍스트

- 모든 한국어 UI 문자열은 `lib/i18n.ts` 의 `ko` 객체에 모은다.
- 컴포넌트에 한국어 리터럴 직접 작성 금지 (i18next 도입 시 마이그레이션 쉽게).
- 예외: 디버그 로그, 주석.

---

## 9. 어르신 화면 (`app/(device)/*`) 추가 규칙

- 폰트 최소 `text-3xl` (모바일·태블릿 기준)
- 색상: 베이지/우드 톤. `slate-900` 같은 어두운 배경 금지.
- 인터랙티브 요소 5개 초과 금지.
- **금지 단어** (한국어 UI 또는 LLM 응답 어디에도):
  - "기록되었습니다", "저장합니다", "녹음합니다", "수집합니다"
  - "어떻게 도와드릴까요?", "무엇을 도와드릴까요?"
  - "힘내세요!", "긍정적으로!"
- 버튼 라벨은 명사+동사 (예: "이야기 시작", "잠시 멈추기"), 챗봇 톤 금지.

---

## 10. 에러 처리

- API route에서 throw 금지 → 항상 `NextResponse.json({ error: ... }, { status })` 반환.
- 어르신 화면에서 STT/LLM/TTS 실패 시: 화면이 깨지지 않고, 사진+시계로 자연스럽게 전환.
- 사용자에게 "오류가 발생했습니다" 같은 시스템 메시지를 어르신에게 보여주지 않는다.
- 가족 화면에서는 명확한 에러 메시지 OK.

---

## 11. 보안

- 가족이 입력한 `family_questions.raw_question` 은 LLM에 직접 넣지 않는다 → `softenFamilyQuestion` 함수가 prompt injection 방어 후 변환.
- 디바이스 토큰은 서명된 JWT 또는 HMAC. 평문 비교 금지.
- 음성 파일은 Supabase Storage signed URL로만 노출 (public 금지).

---

## 12. Git / PR

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- 한 PR에 여러 관심사 섞지 않기. (DB 스키마 변경 + UI 변경 = 분리)
- PR 본문 3섹션 필수: **변경 / 이유 / 테스트한 시나리오**
- `main` 직접 push 금지. PR 통해 머지.

---

_v3 / 2026-04-27_
