# MOT Care MVP

**Memory Of Trust – AI Senior Care Platform**

AI 상담형 고령인구 및 독거노인 돌봄 케어 시스템 MVP

## 프로젝트 개요

- 대화형 인터뷰 방식으로 생애 정보와 스토리를 수집하여 DB에 저장
- 누적 대화 로그를 기반으로 자서전 초안을 자동 생성
- 대화 내용에서 우울/위험 신호를 감지하고 보호자/운영자에게 알림
- 향후 전화(ARS) 연동과 지자체·병원·복지기관과의 연계를 고려한 구조

> **주의사항**: 이 시스템은 의료행위가 아니며, 의학적 진단/치료를 제공하지 않습니다. 위험 분석은 보조적 참고용이며, 반드시 사람에 의한 최종 판단이 필요합니다.

## 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript + React + Tailwind CSS
- **Backend**: Next.js API Routes / Server Actions
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **AI**: OpenAI GPT-4o (대화/요약/자서전 스토리화)
- **Hosting**: Vercel (Front + API), Supabase Cloud (DB)

## 프로젝트 구조

```
mot-care-mvp/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   ├── (dashboard)/       # 운영자 대시보드
│   ├── api/               # API Routes
│   └── layout.tsx         # 루트 레이아웃
├── lib/
│   ├── supabase/          # Supabase 클라이언트 설정
│   │   ├── client.ts      # 브라우저 클라이언트
│   │   └── server.ts      # 서버 클라이언트
│   └── openai.ts          # OpenAI 클라이언트 설정
├── types/
│   └── database.ts        # 데이터베이스 타입 정의
├── supabase/
│   └── migrations/        # DB 마이그레이션 SQL
│       └── 001_initial_schema.sql
└── .env.local.example      # 환경변수 예시
```

## 시작하기

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경변수 파일 생성
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 다음 값들을 설정하세요:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `OPENAI_API_KEY`: OpenAI API 키

### 2. Supabase 데이터베이스 설정

1. [Supabase](https://app.supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 실행
3. Authentication > Settings에서 Email 인증 활성화 (Magic Link 또는 OTP)

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 데이터베이스 스키마

### 주요 테이블

- **elders**: 어르신 프로필 정보
- **sessions**: 인터뷰 세션
- **messages**: 대화 메시지 로그
- **biographies**: 자서전 데이터
- **alerts**: 위험도 알림

자세한 스키마는 `supabase/migrations/001_initial_schema.sql` 참조

## 개발 로드맵

1. ✅ 프로젝트 구조 세팅 (Next.js + TS + Supabase 연동)
2. ✅ DB 스키마 설계 및 마이그레이션 코드 작성
3. ⏳ Auth + 기본 Admin UI
4. ⏳ 인터뷰 세션 UI + 텍스트 기반 GPT 연동
5. ⏳ 음성 입력(STT) 및 TTS 통합
6. ⏳ 위험도 분석 로직 구현
7. ⏳ 자서전 생성/편집 화면 구현

## 보안 및 개인정보 보호

- 주민번호, 정확한 주소 등 민감 정보는 저장하지 않음
- 이름/연락처는 최소화된 형태로 저장
- Row-Level Security (RLS) 적용으로 운영자 전용 접근 제어
- 로그/에러 처리 시 민감 발화 내용 노출 방지

## 라이선스

이 프로젝트는 연구·실증용(파일럿) 목적으로 개발되었습니다.
