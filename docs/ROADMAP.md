# ROADMAP.md — MOT Phase 로드맵

> Master Document v3 §13, §17 발췌. 단기 마일스톤 + Cogno 결합.

---

## 13. Phase 로드맵

| Phase | 기간 | 목표 | DoD |
|---|---|---|---|
| **Sprint 0** | 1주 | 최소 발화 루프 | `.ai/harness.md` §11 DoD |
| **Phase 1** | 1~2개월 | 본인 가족 어르신 1명 한 달 운용 | 30회+ 발화 누적, 주간 카드 1회 수동 발송 |
| **Phase 2** | 3~4개월 | 5가구 베타, 자동화 + Cogno 후처리 | 주간 카드 자동, 가족 질문 업로드, 결제 연동 |
| **Phase 3** | 5~8개월 | 10~20가구, 풀 오픈소스 자체 호스팅 | 월간 챕터 자동, faster-whisper + XTTS-v2 전환 |
| **Phase 4** | 9개월+ | 라디오 외형 OEM 협업, 50명+ | 첫 자서전 출판, 보이스 클로닝 추모 콘텐츠 |

---

## Sprint 0 (현재) — 1주

### Goal

> **사진 보고 → 한 마디 → DB 저장 → 자녀 대시보드 표시**

### Tasks

`.ai/harness.md` §11 의 T1~T8.

### Definition of Done

- [ ] 사진을 보면서 어르신이 한 마디 → 30초 안에 DB 영구 저장
- [ ] AI가 부드럽게 한 문장 응답하고 음성으로 재생
- [ ] 자녀가 웹 대시보드에서 transcript 열람

---

## Phase 1 — 1~2개월

### Goal
본인 가족 어르신 1명이 한 달 동안 자연스럽게 사용.

### 주요 작업

- 하루 3회 스케줄 발화 (10:30 / 15:00 / 19:00 ±15분)
- 야간 ambient 모드 (시계+사진 슬라이드)
- 사진 5장 → 30장으로 늘리기
- 첫 가족 질문 업로드 기능 (F5) MVP
- 주간 카드 **수동** 생성 → 가족에게 이메일 (이지형 본인이 직접)

### 검증 가설

- [ ] 어르신이 거치형에 자연스럽게 말 거는가
- [ ] 사진 트리거가 실제로 이야기를 끌어내는가
- [ ] STT 한국어/사투리 정확도가 충분한가
- [ ] 30회+ 발화 누적 시 어떤 패턴이 보이는가

---

## Phase 2 — 3~4개월

### Goal
5가구 베타. 자동화와 Cogno 후처리 결합 시작.

### 주요 작업

- 주간 카드 **자동 생성 + 카카오 알림톡 발송**
- 가족 질문 업로드 (F5) 정식 출시
- 토스페이먼츠 연동 (구독 결제)
- 8축 추출 배치 워커 (Cogno로)
- 디바이스 회수/배송 SOP

### 검증 가설

- [ ] 자녀가 월 10~20만원 결제하는가
- [ ] 주간 카드가 가족에게 실제 감동을 주는가
- [ ] 가족 질문 업로드 기능이 실제로 사용되는가
- [ ] 5가구 운용에서 Vercel Cron + Inngest 충분한가

---

## Phase 3 — 5~8개월

### Goal
10~20가구. 풀 오픈소스 자체 호스팅.

### 주요 작업

- 월간 챕터 자동 생성
- STT: faster-whisper-large-v3 자체 호스팅 전환
- TTS: XTTS-v2 보이스 클로닝 (캐릭터 일관성 + 본인 목소리 보존)
- LLM: Cogno (Qwen3.6:35b) 풀 사용
- Expo Android 래퍼 + Lock Task Mode

### 검증 가설

- [ ] 1년 구독 유지율 60%+
- [ ] 월간 챕터 품질이 유지율을 끌어올리는가
- [ ] 자체 호스팅 비용이 외부 API 대비 절감되는가

---

## Phase 4 — 9개월+

### Goal
라디오 외형 OEM 협업. 50명+. 첫 자서전 출판.

### 주요 작업

- 라디오 외형 OEM 시제품 (시판 태블릿 + 케이스/거치대)
- 자서전 책 제작 파이프라인 (디자인·인쇄)
- 본인 목소리 클로닝 추모 편지 (사후 가족용)
- 디지털 묘비 페이지

---

## 17. Cogno 결합 (Phase 2부터)

이지형의 Cogno (Vast.ai 4090, Qwen3.6:35b 베이스) 결합 로드맵:

### Phase 2 — 후처리만 Cogno로

| 작업 | Phase 1 | Phase 2 |
|---|---|---|
| 실시간 응답 (디바이스 ↔ 어르신) | OpenAI GPT-4o-mini | OpenAI GPT-4o-mini (유지, 속도) |
| 8축 추출 (`/api/cron/extract-axes`) | GPT-4o | **Cogno** |
| 주간 카드 생성 (`/api/cron/weekly-card`) | GPT-4o | **Cogno** |
| 월간 챕터 생성 | GPT-4o | **Cogno** |

### Phase 3 — 풀 자체 호스팅

| 작업 | Phase 2 | Phase 3 |
|---|---|---|
| `/api/llm/respond` | GPT-4o-mini | **Cogno** |
| `/api/stt` | OpenAI Whisper | **faster-whisper-large-v3** |
| `/api/tts` | 클로바보이스 | **XTTS-v2** |

### Phase 4 — Cogno 진화

- MOT 발화 데이터로 Cogno 한국어 어르신 도메인 파인튜닝
- 정서적 한국어 데이터 = Cogno만의 학습 자산

### MCP 결합 (선택)

Cogno에 MCP 서버 형태로 다음 도구 노출:

```
mot.next_prompt(elder_id)        — 다음 프롬프트 결정
mot.recall_recent(elder_id, n)   — 최근 발화 회수
mot.unresolved_items(elder_id)   — 미해결 큐 조회
```

이렇게 하면 Cogno가 MOT의 "두뇌" 역할을 하면서, 다른 프로젝트(WhereHere, 진드기맨)와도 자원 공유 가능.

---

## 운영 체크리스트 (Phase 전환 시)

각 Phase 종료 시 다음을 확인:

- [ ] 발화 데이터 손실 0건
- [ ] RLS 정책 위반 0건
- [ ] 어르신 화면 금지어 노출 0건
- [ ] 가족 결제 이슈 0건
- [ ] 다음 Phase 핵심 기능의 PoC 완료

---

_v3 / 2026-04-27_
