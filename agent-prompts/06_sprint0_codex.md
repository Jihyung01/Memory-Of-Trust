# 06. Sprint 0 Initializer — Codex GPT-5.5

> 역할: 빈 레포 또는 막 만든 Next.js 스캐폴드에서 **Sprint 0 (T1~T8) 진행**.
> 모델: **GPT-5.5 in Codex** (`gpt-5.5`)
> 도구: Codex Windows 앱 (병렬 worktree 권장)
> 입력: 현재 단계 (T1~T8 중 어디)
> 출력: 그 단계까지의 완료된 코드

---

## 전제 조건

- Windows 환경 (Codex 앱 권장) 또는 macOS
- Node.js 20+
- pnpm 설치 (`npm i -g pnpm`)
- Supabase 계정 및 프로젝트
- OpenAI API 키
- 네이버 클로바보이스 API 키

---

## 진행 원칙

1. **순서를 절대 건너뛰지 않는다.** T1 → T2 → ... → T8.
2. 각 Task 완료 시 짧은 요약 보고 후 다음으로.
3. T2(스키마 적용) 끝나기 전에는 T3 이후를 건드리지 않는다.
4. 시드 데이터 없이는 T8 동작 확인이 불가능하므로 T2의 시드 단계는 필수.

---

## 프롬프트 본체

```
너는 MOT 프로젝트의 Sprint 0 진행 담당이다.

먼저 정독:
- AGENTS.md
- .ai/harness.md (특히 §11 Sprint 0 Tasks)
- .ai/conventions.md
- docs/ARCHITECTURE.md §7 파일 구조

목표:
.ai/harness.md §11의 T1~T8을 순서대로 완료한다.

현재 단계: [T1 / T2 / ... / T8 중 하나]

규칙:
1. 순서 절대 건너뛰지 마라.
2. 각 Task 완료 시 짧게 보고하고 다음 Task 시작 전 사용자 확인을 받는다.
   - 단, 사용자가 "T1~T3 한 번에 진행해" 같이 명시하면 묶어서 진행 가능.
3. 환경 변수가 필요하면 .env.local 에 채울 항목을 사용자에게 묻는다.
4. Supabase 프로젝트 ID, OpenAI 키, 클로바보이스 키 같은 secret 은 사용자에게 받는다.
   - 절대 추측하거나 placeholder를 그대로 두지 않는다.
5. Supabase 마이그레이션은 supabase/migrations/ 의 SQL 파일을 그대로 SQL Editor 에 붙여넣는 방법을 안내.
6. 시드 데이터(supabase/seed.sql)도 적용.
7. T8까지 끝나면 "Sprint 0 DoD 시나리오 검증" 단계 수행:
   - 디바이스 페이지에서 사진 보고 한 마디 → DB raw_utterances 저장 → 자녀 대시보드 표시
   - 영상 또는 텍스트 로그로 증거 남기기
8. 어르신 화면 UX는 docs/PROMPTS.md 의 금지 단어 절대 노출 금지.

T별 출력 형식:

### T<n> 시작 보고
- 변경할 파일 목록
- 새 의존성 (필요한 것만)
- 사용자에게 받을 입력 (있을 때)

### T<n> 진행
- (실행한 명령어와 결과)

### T<n> 완료 보고
- 변경된 파일 (생성/수정)
- 검증 결과
- 다음 Task로 진행 가능 여부
```

---

## T별 빠른 가이드

### T1. 프로젝트 초기 설정

```powershell
pnpm create next-app@latest mot --typescript --tailwind --app --src-dir=false --import-alias "@/*"
cd mot
pnpm dlx shadcn@latest init
mkdir lib/supabase, lib/ai, lib/voice, lib/kakao, lib/billing
```

`.env.example` 작성 (이 레포의 `.env.example` 복사).
`next.config.ts` 에 PWA 설정. `public/manifest.json` 생성.

### T2. Supabase 스키마

1. Supabase 콘솔 → 새 프로젝트.
2. SQL Editor → `supabase/migrations/20260427000001_initial_schema.sql` 붙여넣고 RUN.
3. SQL Editor → `supabase/migrations/20260427000002_rls_policies.sql` 붙여넣고 RUN.
4. SQL Editor → `supabase/seed.sql` 붙여넣고 RUN (시드: elder 1, family_member 1, photos 5).
5. CLI:
   ```powershell
   pnpm dlx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
   ```

### T3. 디바이스 인증 + 다음 프롬프트 조회

`app/api/device/auth/route.ts`:
- POST `{ device_token }` → `{ elder_id, session_token }`
- HMAC 또는 서명된 JWT 사용. 평문 비교 금지.

`app/api/device/next-prompt/route.ts`:
- 가장 적게 보여준 active 사진 1장 선택
- LLM(GPT-4o-mini)으로 `photoTriggerPrompt` 호출
- `{ prompt_id, prompt_type: 'photo_trigger', prompt_text, photo_url, photo_caption }` 반환

### T4. 어르신 디바이스 화면

`app/(device)/device/[deviceId]/page.tsx` — 시계 + 사진 + 한 문장 + 마이크.
- Tailwind: 베이지/우드 톤 (예: `bg-amber-50`, `text-stone-800`)
- 폰트: `text-3xl` 이상
- 인터랙티브 요소 5개 이하
- PWA fullscreen 강제 (`<html lang="ko" data-fullscreen>` + manifest `display: standalone`)

### T5. 음성 녹음 + STT + 저장

`lib/voice/recorder.ts` — `MediaRecorder` 래퍼 (webm/opus).
`app/api/stt/route.ts` — Whisper API, **`language: "ko"` 강제**.
`app/api/device/utterance/route.ts`:
- audio Blob → Supabase Storage 업로드 (signed URL)
- Whisper 호출 → transcript
- `raw_utterances` INSERT (service_role 키로)
- → 다음 단계 (T6)에서 LLM 응답 생성으로 chain

### T6. LLM 응답 + TTS 재생

`app/api/llm/respond/route.ts`:
- `ELDER_CHARACTER_SYSTEM_PROMPT` + 직전 발화 → 1~2문장 응답
- 모델: `env.OPENAI_RESPONSE_MODEL` (기본 `gpt-4o-mini`)

`app/api/tts/route.ts`:
- 클로바보이스 호출, mp3 임시 URL 반환

디바이스에서 응답 mp3 자동 재생 (`<audio autoPlay>` 또는 Web Audio API).

### T7. 자녀 대시보드

Supabase Auth 매직링크 로그인.
`app/(family)/family/[elderId]/page.tsx` — 발화 목록 (최근순).
`app/(family)/family/[elderId]/photos/page.tsx` — 사진 업로드 폼.

### T8. 동작 확인 (DoD)

본인이 어르신 역할로 실제 발화 → 모든 단계 통과 확인.

---

## 사용자에게 받을 입력 (T2/T3 전)

```
[ ] Supabase Project URL
[ ] Supabase Anon Key
[ ] Supabase Service Role Key
[ ] OpenAI API Key
[ ] 네이버 클로바보이스 Client ID
[ ] 네이버 클로바보이스 Client Secret
[ ] 네이버 클로바보이스 Voice ID (vara / nshin / nara 중 선택)
[ ] (Sprint 0에선 옵션) DEVICE_AUTH_SECRET — 임의 32+ 자
```

---

_v3 / 2026-04-27_
