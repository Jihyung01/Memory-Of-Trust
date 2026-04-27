# SCHEMA.md — MOT 데이터베이스 스키마

> Master Document v3 §6 발췌. 실제 SQL은 `supabase/migrations/` 에 있다.
> 이 문서는 **데이터 모델의 의미와 불변식(invariant)** 을 설명한다.

---

## 6-1. 핵심 원칙

1. **`raw_utterances` 는 append-only, immutable.** 절대 UPDATE/DELETE 금지. (DB 트리거가 강제.)
2. 모든 테이블에 RLS 적용. 가족 멤버는 자기 가족 데이터만 접근 가능.
3. **8축 데이터는 별도 테이블로 분리해서 누적.** 원본 발화 위에 레이어를 쌓는다.
4. `created_at`, `updated_at` 모든 테이블에 기본 포함.

---

## 6-2. 테이블 카탈로그

### 사용자 / 가족

| 테이블 | 용도 | 비고 |
|---|---|---|
| `elders` | 어르신 (디바이스 사용자) | `display_name`은 디바이스 호칭 ("아버님") |
| `family_members` | 자녀/가족 (auth.users 연결) | `is_payer` 결제자 표시 |
| `devices` | 태블릿 디바이스 | `device_token` 으로 인증 |

### 사진 / 트리거

| 테이블 | 용도 |
|---|---|
| `photos` | 가족이 업로드한 사진 (가장 강력한 트리거) |
| `family_questions` | 가족이 입력한 질문. AI가 `softened_question` 으로 변환 (F5 차별점) |
| `prompts` | 시스템이 디바이스에 던진 모든 프롬프트 기록 |

### 원본 발화 (Immutable)

| 테이블 | 용도 |
|---|---|
| `raw_utterances` | **모든 어르신 발화 원본.** UPDATE/DELETE 트리거로 차단. |

### 8축 누적 데이터 (별도 레이어)

| 축 | 테이블 | 의미 |
|---|---|---|
| when | `timeline_events` | 인생 사건들 (연도/나이) |
| who | `entities` | 등장 인물 (가족/친구/직장 동료/...) |
| what | `themes` | 반복되는 주제·가치관 |
| how | `emotion_layer` | 발화별 감정 (1~5 강도) |
| unresolved | `unresolved_queue` | ⭐ 사과/감사/한 — MOT 정서적 핵심 |
| sensory | `sensory_details` | 감각 디테일 ("어머니 손에서 나던 마늘 냄새") |
| verified | `verifications` | 가족이 보충/정정 (원본 수정 X) |
| narrative | `story_outputs` | 서사화 결과 (주간 카드, 챕터, 자서전) |

### 후보 / 산출물 / 결제

| 테이블 | 용도 |
|---|---|
| `memory_candidates` | 발화에서 추출한 사실 후보 (검증 전) |
| `story_outputs` | 주간 카드, 월간 챕터, 자서전, 편지, 미해결집 등 |
| `subscriptions` | 가구별 구독 (pilot/beta/premium) |

---

## 6-3. RLS (Row Level Security) 핵심 정책

```
elders        : SELECT — family_members.user_id == auth.uid() 인 elder만
raw_utterances: SELECT — 자기 가족 elder의 발화만
              : INSERT — service_role 만 (디바이스 토큰 검증 후 백엔드가 INSERT)
              : UPDATE — 차단 (트리거)
              : DELETE — 차단 (트리거)
photos        : SELECT/INSERT — 가족 멤버
family_questions : INSERT — 가족 멤버, SELECT — 자기 가족
story_outputs : SELECT — 자기 가족
```

전체 정책은 `supabase/migrations/20260427000002_rls_policies.sql` 참조.

---

## 6-4. 불변식 (Invariants)

코드가 어떤 경우에도 깨면 안 되는 것:

1. **`raw_utterances.transcript` 는 한 번 INSERT 되면 변경 불가.** 가족이 정정하고 싶다면 `verifications` 테이블에 `family_note`로 추가만.
2. **`raw_utterances.audio_url` 의 Storage 객체도 변경 불가.** Storage RLS와 정책으로 보호.
3. **`family_questions.raw_question` 은 LLM에 직접 전달 금지.** 반드시 `softenFamilyQuestion`이 만든 `softened_question`이 디바이스에 전달됨.
4. **`elder_id` 는 모든 8축 테이블에 항상 존재.** RLS는 항상 `elder_id` 기준으로 동작.
5. **`subscriptions.status = 'cancelled'` 라도 데이터는 즉시 삭제하지 않는다.** 보존 기간은 별도 정책 (사후 50년 옵션 고려).

---

## 6-5. 인덱스 전략

| 인덱스 | 이유 |
|---|---|
| `idx_utterances_elder_time` | 발화 시간순 조회 (대시보드) |
| `idx_photos_elder` (active=true) | 디바이스에 보여줄 사진 후보 |
| `idx_family_questions_pending` | 디바이스가 다음 질문 가져올 때 |
| `idx_prompts_scheduled` | 워커가 발송 대기 프롬프트 조회 |
| `idx_outputs_delivery` | 주간/월간 카드 발송 큐 |

---

## 6-6. 마이그레이션 운영

- 마이그레이션 파일은 `YYYYMMDDHHMMSS_*.sql` 형식.
- **기존 마이그레이션 파일은 절대 수정하지 않는다.** 새 마이그레이션을 추가한다.
- Production 적용 전 staging Supabase 프로젝트에서 검증.
- 컬럼 DROP / NOT NULL 추가 같은 파괴적 변경은 단계 분할:
  1. 컬럼 추가 (NULL 허용)
  2. 백필 (별도 마이그레이션)
  3. NOT NULL 적용
  4. 구 컬럼 DROP (다음 릴리즈)

---

_v3 / 2026-04-27_
