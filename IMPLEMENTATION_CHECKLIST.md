# 자서전 인터뷰 엔진 구현 체크리스트

## ✅ 완료된 기능 확인

### 1. DB 스키마 확장

#### interview_sessions 테이블
- ✅ `session_type` 필드 추가 (ENUM: 'care' | 'biography' | 'checkin')
- ✅ `channel` 필드 (TEXT: 'web', 'phone', 'kiosk' 등)
- ✅ `summary` 필드 (TEXT)
- ✅ `risk_level_after` 필드 (이미 존재, 활용)

**파일**: `supabase/migrations/003_add_biography_support.sql`

#### biographies 테이블
- ✅ `outline` 필드 추가 (TEXT - 목차/챕터 구조)
- ✅ `session_id` 필드 추가 (UUID - 연결된 세션)

**파일**: `supabase/migrations/003_add_biography_support.sql`

### 2. GPT 프롬프트 설계

#### lib/biography/prompts.ts
- ✅ `generateFirstQuestion(elderName?)` - 첫 질문 생성
- ✅ `getNextQuestionAndRisk(messages)` - 다음 질문 생성 + 위험도 분석
  - JSON 형식으로 `nextQuestion`과 `riskLevel` 반환
  - 위험도: 'none' | 'mild' | 'high'
- ✅ `generateBiographyDraft(messages)` - 자서전 초안 생성
  - JSON 형식으로 `title`, `outline`, `content` 반환
- ✅ `convertRiskLevelToStandard()` - 위험도 변환 유틸리티

**구현 내용**:
- 질문 생성: 시대별로 고르게, 함께 회상하는 느낌
- 위험 신호 감지: 우울감, 상실감, 자살 위험 등
- 자서전 생성: 시간 순서 정리, 사실 중심, 존엄 유지

### 3. API Routes 구현

#### /api/biography/start
- ✅ 세션 생성 (session_type='biography')
- ✅ 첫 질문 생성 및 저장
- ✅ 어르신 정보 확인
- ✅ 인증 확인

**Request**: `{ elderId, channel? }`
**Response**: `{ sessionId, question }`

#### /api/biography/continue
- ✅ 사용자 답변 저장 (user role)
- ✅ 대화 히스토리 로드
- ✅ GPT로 다음 질문 + 위험도 생성
- ✅ 질문 저장 (assistant role)
- ✅ 위험도가 높으면 alerts 테이블에 기록

**Request**: `{ sessionId, elderId, answer }`
**Response**: `{ nextQuestion, riskLevel }`

#### /api/biography/draft
- ✅ 세션의 모든 메시지 로드
- ✅ GPT로 자서전 초안 생성 (title, outline, content)
- ✅ biographies 테이블에 저장
- ✅ 기존 자서전이 있으면 업데이트, 없으면 새로 생성
- ✅ 버전 관리 (version 자동 증가)
- ✅ 세션 summary 업데이트

**Request**: `{ sessionId, elderId }`
**Response**: `{ biography }`

### 4. UI 구현

#### 자서전 인터뷰 메인 페이지
- ✅ `/dashboard/elders/[id]/biography/page.tsx`
  - 자서전 인터뷰 시작 UI
  - 생성된 자서전 목록
  - 인터뷰 세션 목록

#### 자서전 인터뷰 컴포넌트
- ✅ `biography-interview.tsx`
  - 세션 시작 버튼
  - 실시간 대화 UI (Chat-like)
  - 질문/답변 입력
  - 위험도 표시
  - 자서전 초안 생성 버튼

#### 자서전 상세 페이지
- ✅ `/dashboard/elders/[id]/biography/[biographyId]/page.tsx`
  - 자서전 제목, 목차, 본문 표시
  - 버전 정보 표시

#### 어르신 상세 페이지 통합
- ✅ 자서전 인터뷰 버튼 추가
- ✅ 기존 인터뷰와 구분

### 5. 타입 정의

#### types/database.ts
- ✅ `SessionType` 타입 추가
- ✅ `SessionChannel` 타입 확장
- ✅ `interview_sessions` 타입에 `session_type` 추가
- ✅ `biographies` 타입에 `outline`, `session_id` 추가

### 6. 채널-중립 설계

#### 웹 채널
- ✅ 현재 구현됨
- ✅ `/dashboard/elders/[id]/biography` 페이지

#### ARS 채널 (향후)
- ✅ API 설계 완료
- ✅ 동일한 API 엔드포인트 사용 가능
- ✅ `channel='phone'` 파라미터로 구분
- 📝 STT/TTS 래퍼만 추가하면 됨

**ARS 사용 예시** (의사 코드):
```javascript
// 전화 수신 → STT → API 호출 → TTS → 전화 재생
const answer = await stt.listen()
const { nextQuestion } = await fetch('/api/biography/continue', {
  body: JSON.stringify({ sessionId, elderId, answer, channel: 'phone' })
})
await tts.speak(nextQuestion)
```

### 7. 문서화

- ✅ `BIOGRAPHY_ENGINE.md` - 엔진 가이드
- ✅ `IMPLEMENTATION_CHECKLIST.md` - 이 파일
- ✅ README.md 업데이트

## 📋 요청사항 대비 구현 현황

### 사용자 요청사항

1. ✅ **전체 구조 개념 (텍스트/ARS 공통)**
   - Layer A (인터뷰 엔진) + Layer B (채널) 구조 구현

2. ✅ **Supabase / DB 구조 확장**
   - session_type, channel, summary 필드 추가
   - biographies에 outline, session_id 추가

3. ✅ **Next.js / API 설계**
   - /api/biography/start
   - /api/biography/continue
   - /api/biography/draft

4. ✅ **GPT 프롬프트 설계**
   - 질문 생성 + 위험도 감지
   - 자서전 초안 생성

5. ✅ **ARS 연동 설계**
   - 문서화 완료
   - 동일 API 사용 가능하도록 설계

6. ✅ **UI 구현**
   - 자서전 인터뷰 페이지
   - Chat-like 인터페이스
   - 자서전 상세 보기

## 🎯 핵심 기능 확인

### 채널-중립 설계 ✅
- 웹과 ARS가 동일한 API 사용
- channel 파라미터로 구분
- 향후 확장 용이

### 질문 생성 엔진 ✅
- GPT 기반 동적 질문 생성
- 시대별 고르게 질문
- 위험 신호 동시 감지

### 자서전 생성 ✅
- 대화 로그 기반 자서전 초안 생성
- 목차(outline) + 본문(content) 구조
- 버전 관리 지원

### 위험도 분석 ✅
- 실시간 위험 신호 감지
- alerts 테이블 자동 기록
- 위험도 레벨 표시

## ✅ 모든 요청사항 구현 완료!
