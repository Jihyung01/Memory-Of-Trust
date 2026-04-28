# PHASE 1 PLAN — 본인 가족 어르신 1명 한 달 운용

> 기간: 6~8주 (Sprint 0 종료 다음날 ~ 첫 자서전 챕터 초안)
> 목표: **이지형의 실제 가족 어르신 1명**이 7인치 태블릿으로 매일 사용하는 패턴을 한 달간 누적.
> 끝났을 때 갖는 것: 발화 50회+, 사진 30장+, 주간 카드 4~5회 발송 이력, 첫 월간 챕터 초안.

---

## Sprint 0 vs Phase 1 (감각 잡기)

| 항목 | Sprint 0 (방금 끝낸 것) | Phase 1 |
|---|---|---|
| 목적 | 기술 루프 1회 증명 | **운영 가설 검증** |
| 사용자 | 본인 (개발 디바이스) | 진짜 어르신 1명 |
| 환경 | 데스크톱 Chrome | 7인치 태블릿 + 거실 거치 |
| 데이터 | 시드 + 시뮬레이션 발화 | 진짜 발화 30회+ |
| 검증 도구 | DB INSERT 직접 확인 | 어르신·가족 피드백 |
| 비용 | 거의 0원 | API 비용 ~1.5만원/월 |

---

## 가설 (Phase 1 끝났을 때 답하고 싶은 질문)

- [ ] 어르신이 거치형 화면에 자연스럽게 말을 거는가
- [ ] 사진 트리거가 실제로 이야기를 끌어내는가
- [ ] 한국어/사투리 STT 정확도가 운영 가능 수준인가
- [ ] AI 캐릭터 톤이 어르신에게 부담을 주지 않는가
- [ ] 30회+ 발화 누적 시 어떤 패턴이 보이는가 (반복 주제, 정서 분포)
- [ ] 자녀가 주간 카드를 받아보고 어떤 반응을 보이는가
- [ ] 가족 질문 업로드 (F5) 가 실제로 사용되는가
- [ ] 하루 3회 스케줄 발화 중 어르신이 응답하는 비율

이 8개에 대답이 모이면 Phase 2 (5가구 베타) 진입 결정 가능.

---

## 6~8주 일정

### Week 1 — 인프라 운영화

- [ ] Vercel 프로덕션 배포 (도메인 연결, env 동기화)
- [ ] Supabase production 프로젝트 별도 분리 (현재 dev 와 분리)
- [ ] OpenAI Usage limit 설정 ($30/월 안전선)
- [ ] 클로바보이스 결제 등록
- [ ] `.env.staging` 추가 (test → staging → production 흐름)
- [ ] Sentry 또는 Vercel Logs 모니터링 채널 (디스코드/메일)
- [ ] **device_token HMAC 통일** — Sprint 0 의 dev 평문 폴백 제거. 토큰 발급 스크립트 (`scripts/issue-device-token.mjs`).

### Week 2 — 디바이스 셋업 + 첫 거치

- [ ] 7인치 안드로이드 태블릿 구매 (예: 갤럭시 탭 A7 Lite, 약 15만원)
- [ ] Chrome 키오스크 모드 셋업 + 자동 시작
- [ ] 화면 자동 꺼짐 비활성화, 절전모드 우회
- [ ] LTE eSIM 또는 와이파이 연결 안정화
- [ ] 거치대 또는 라디오형 케이스 (3D 프린트 또는 시판 중 한 가지)
- [ ] **사진 30장 업로드** — 가족 모임에서 옛 앨범 스캔. 캡션·연도·인물 메모 첨부.
- [ ] 어르신께 디바이스 전달 + 첫 사용 시연
- [ ] **음성/대화 녹음 동의서** 어르신·가족 서명 (서식 별도 작성)

### Week 3-4 — 일일 운영

- [ ] 하루 3회 스케줄 발화 (10:30 / 15:00 / 19:00 ±15분)
- [ ] **응답률 추적** — 어르신이 마이크 누른 비율, 스킵 비율
- [ ] STT 정확도 추적 — 발화 vs transcript 차이 메모 (사용자가 직접 들어보고 평가)
- [ ] 가족 질문 업로드 (F5) 1차 활성화 — 본인이 직접 질문 5개 입력 시범
- [ ] 야간 ambient 모드 동작 확인 (22:00 ~ 07:00 사진 슬라이드만)
- [ ] **첫 주간 카드 수동 생성 + 메일 발송** (Codex 자동화는 Phase 2)
- [ ] 어르신 피드백 정성 인터뷰 (주 1회 30분)

### Week 5-6 — 8축 추출 + 첫 챕터

- [ ] `app/api/cron/extract-axes/route.ts` 활성화 — 야간 배치
- [ ] 8축 데이터 누적 30회+ 발화에서 어떻게 보이는지 분석
- [ ] **첫 월간 챕터 초안 생성** (자동 cron, 수동 fallback 가능)
- [ ] 가족이 챕터 초안 검수 → 정정/보충 (verifications 테이블)
- [ ] 미해결 큐(unresolved_queue) 항목 검토 — 진짜 미해결인지, 가족 검수 필요한지
- [ ] 어르신 사망 가정 시뮬레이션 — 발화 데이터 가족 접근 권한 점검 (법무 검토)

### Week 7-8 — 회고 + Phase 2 결정

- [ ] 8개 가설(위 §가설)에 대한 답 정리
- [ ] STT 한국어 정확도 수치화 (정확도 90%+ 면 OK, 그 이하면 faster-whisper 조기 도입 검토)
- [ ] OpenAI 비용 실측 (가구당 월 얼마 나왔는지)
- [ ] 어르신·가족 NPS 설문 (10점 만점)
- [ ] **Phase 2 진입 결정**: 5가구 베타 모집 시작 vs Phase 1 연장
- [ ] 회고 문서 `docs/PHASE1_RETROSPECTIVE.md` 작성

---

## Phase 1 동안 만들 코드 (Sprint 0 위에 추가)

| 영역 | 파일 | 우선순위 |
|---|---|---|
| device_token HMAC 통일 | `scripts/issue-device-token.mjs`, `lib/supabase/server.ts` 정리 | 🔴 Week 1 |
| 스케줄 발화 | `app/api/cron/schedule-prompt/route.ts`, Vercel Cron | 🔴 Week 1 |
| 가족 질문 업로드 (F5) | `app/(family)/family/[elderId]/questions/page.tsx`, `app/api/questions/route.ts` | 🔴 Week 2 |
| 야간 ambient | `app/(device)/device/[deviceId]/ambient.tsx` | 🟡 Week 2 |
| 주간 카드 수동 생성 도구 | `app/(family)/family/[elderId]/cards/page.tsx`, `app/api/cron/weekly-card/route.ts` (수동 트리거) | 🔴 Week 3 |
| 카카오 알림톡 | `lib/kakao/alimtalk.ts`, 발신 프로필 등록 | 🟡 Week 3 |
| 8축 추출 배치 | `app/api/cron/extract-axes/route.ts`, `lib/ai/extract-axes.ts` | 🔴 Week 5 |
| 월간 챕터 자동 | `app/api/cron/monthly-chapter/route.ts` | 🟡 Week 5 |
| 운영 모니터링 | `app/(family)/admin/page.tsx` (본인용) | 🟢 시간 되면 |

---

## 구체적 비용 (가구당 월)

| 항목 | 비용 |
|---|---|
| 태블릿 (1회성, 18개월 상각) | ~9천원 |
| OpenAI (Whisper + 4o-mini + 4o + TTS) | ~1.5만원 |
| 네이버 클로바보이스 (Phase 1 그대로 두면) | ~3천원 |
| Supabase Pro | 가구 분담 시 ~1천원 |
| Vercel Pro | 가구 분담 시 ~1천원 |
| 카카오 알림톡 | 발송당 12원 × 4건/월 = ~50원 |
| **합계** | **~2만원/월** |

→ Phase 2 9.9만원 구독가 기준 마진 ~7~8만원. 자녀 1가구가 부담할 수 있는 구조.

---

## 위험 + 대응

| 위험 | 대응 |
|---|---|
| 어르신이 마이크 안 누름 | 사진 슬라이드 + ambient 모드로 거리감 줄이기. 강요 X. |
| STT 사투리 오인식 | 30회 누적 후 정확도 평가. 90% 미만이면 faster-whisper 자체 호스팅 조기 도입. |
| OpenAI 비용 폭주 | Usage limit + 일일 사용량 알림 |
| 와이파이 단절 | LTE eSIM 백업 옵션 |
| 가족 질문 prompt injection | softenFamilyQuestion 필터 강화 + 7번 Prompt Engineer 검수 |
| 어르신이 발화한 내용 중 위험 신호 | Phase 1 동안 본인이 직접 검토. Phase 2부터 자동 알람. |
| 디바이스 분실/도난 | device_token 회전 + raw_utterances는 RLS 로 보호 (디바이스만 잃어도 데이터 안전) |

---

## Phase 1 끝났을 때 갖고 있을 것

- [ ] 어르신 발화 50회+ (transcript + audio)
- [ ] 8축 데이터 누적 (timeline_events 10+, entities 15+, themes 5+, unresolved 3+)
- [ ] 주간 카드 4~5회 발송 이력
- [ ] 월간 챕터 초안 1개
- [ ] 가족 피드백 (정성)
- [ ] 비용 실측 데이터
- [ ] Phase 2 베타 모집 의사결정

→ **이게 진짜 MVP의 모습.** Sprint 0의 코드 위에 한 달간의 운영 데이터가 얹혀야 비로소 "있다" 라고 말할 수 있다.

---

_v1 / 2026-04-28 / Phase 1 진입용 운영 매뉴얼_
