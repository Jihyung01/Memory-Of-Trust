# 자서전 인터뷰 엔진 가이드

## 개요

MOT Care MVP의 핵심 기능인 **"채널-중립 자서전 Q&A 엔진"**입니다.

이 엔진은 텍스트 기반으로 동작하며, 웹 UI나 ARS(전화) 등 어떤 채널에서도 동일한 API를 사용할 수 있습니다.

## 아키텍처

### Layer A - 인터뷰 엔진 (텍스트 기반)
- 질문 생성 (AI)
- 사용자의 답변 저장 (텍스트)
- 세션별 대화 로그 축적
- 세션 종료 후 자서전 초안 생성

### Layer B - 채널 (웹/ARS)
- **웹**: Next.js Chat UI (현재 구현됨)
- **ARS**: 전화 → STT → 인터뷰 엔진 API 호출 → 응답 텍스트 → TTS → 전화 재생 (향후 구현)

## API 엔드포인트

### 1. `/api/biography/start` - 세션 시작

**POST** `/api/biography/start`

**Request:**
```json
{
  "elderId": "uuid",
  "channel": "web" // 또는 "phone", "kiosk" 등
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "question": "첫 번째 질문 텍스트"
}
```

### 2. `/api/biography/continue` - 대화 계속

**POST** `/api/biography/continue`

**Request:**
```json
{
  "sessionId": "uuid",
  "elderId": "uuid",
  "answer": "사용자의 답변 텍스트"
}
```

**Response:**
```json
{
  "nextQuestion": "다음 질문 텍스트",
  "riskLevel": "low" | "medium" | "high"
}
```

### 3. `/api/biography/draft` - 자서전 초안 생성

**POST** `/api/biography/draft`

**Request:**
```json
{
  "sessionId": "uuid",
  "elderId": "uuid"
}
```

**Response:**
```json
{
  "biography": {
    "id": "uuid",
    "title": "자서전 제목",
    "outline": "목차 구조",
    "content": "자서전 본문",
    ...
  }
}
```

## 사용 방법

### 웹 UI에서 사용

1. `/dashboard/elders/[id]/biography` 페이지 접속
2. "인터뷰 시작하기" 버튼 클릭
3. 질문에 답변 입력
4. 대화가 충분히 진행되면 "자서전 초안 생성" 버튼 클릭

### ARS에서 사용 (향후)

```javascript
// 의사 코드
const phoneCall = receivePhoneCall()
const elderId = identifyElder(phoneCall.phoneNumber)

// 세션 시작
const { sessionId, question } = await fetch('/api/biography/start', {
  method: 'POST',
  body: JSON.stringify({ elderId, channel: 'phone' })
})

// TTS로 질문 읽기
await tts.speak(question)

// STT로 답변 받기
const answer = await stt.listen()

// 대화 계속
const { nextQuestion, riskLevel } = await fetch('/api/biography/continue', {
  method: 'POST',
  body: JSON.stringify({ sessionId, elderId, answer })
})

// 반복...

// 자서전 생성
const { biography } = await fetch('/api/biography/draft', {
  method: 'POST',
  body: JSON.stringify({ sessionId, elderId })
})
```

## GPT 프롬프트 설계

### 질문 생성 프롬프트

- 어르신의 생애를 시대별로 고르게 듣기
- 기억에 남는 사람, 장소, 사건 중심으로 이야기 끌어내기
- 우울감, 상실감, 자살 위험 등 정서적 위험 신호 감지
- 짧고 명료한 질문, 함께 회상하는 느낌

### 자서전 생성 프롬프트

- 시간 순서로 정리 (어린 시절 → 청년기 → 중년기 → 현재)
- 중요한 사람/사건/장소 중심으로 스토리 구조화
- 존중과 따뜻한 톤 유지
- 사실 중심의 서술 (hallucination 방지)

## 데이터베이스 구조

### interview_sessions 테이블
- `session_type`: 'biography' (자서전 인터뷰)
- `channel`: 'web', 'phone', 'kiosk' 등
- `summary`: 세션 요약
- `risk_level_after`: 세션 후 위험도

### biographies 테이블
- `session_id`: 연결된 세션 ID
- `title`: 자서전 제목
- `outline`: 목차/챕터 구조
- `content`: 자서전 본문
- `version`: 버전 번호

## 확장 가능성

이 엔진은 채널-중립적이므로:

1. **웹**: 현재 구현됨 ✅
2. **ARS (전화)**: STT/TTS 래퍼만 추가하면 됨
3. **키오스크**: 터치스크린 UI 추가
4. **챗봇**: 메신저 플랫폼 연동
5. **음성 어시스턴트**: Alexa, Google Home 등

모든 채널에서 동일한 API를 사용하므로, 질문 생성 로직과 자서전 생성 로직을 한 곳에서 관리할 수 있습니다.

## 파일 구조

```
lib/biography/
  └── prompts.ts          # GPT 프롬프트 및 질문 생성 로직

app/api/biography/
  ├── start/route.ts      # 세션 시작 API
  ├── continue/route.ts   # 대화 계속 API
  └── draft/route.ts      # 자서전 초안 생성 API

app/(dashboard)/elders/[id]/biography/
  ├── page.tsx            # 자서전 인터뷰 메인 페이지
  ├── biography-interview.tsx  # 인터뷰 UI 컴포넌트
  └── [biographyId]/page.tsx   # 자서전 상세 보기
```

## 주의사항

1. **위험 신호 감지**: 위험도가 'high'로 감지되면 자동으로 alerts 테이블에 기록됩니다.
2. **세션 타입**: 자서전 인터뷰는 `session_type='biography'`로 구분됩니다.
3. **채널 구분**: `channel` 필드로 웹/전화/키오스크 등을 구분할 수 있습니다.
