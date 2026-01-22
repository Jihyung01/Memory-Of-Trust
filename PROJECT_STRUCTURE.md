# MOT Care MVP - 프로젝트 구조 상세 가이드

## 폴더 구조 및 파일 역할

### `/app` - Next.js App Router

Next.js 14의 App Router를 사용합니다. 각 폴더는 라우트를 나타냅니다.

```
app/
├── (auth)/              # 인증 관련 페이지 그룹 (괄호는 라우트 그룹, URL에 포함되지 않음)
│   ├── login/          # 로그인 페이지
│   └── layout.tsx      # 인증 레이아웃
├── (dashboard)/        # 운영자 대시보드 그룹
│   ├── elders/         # 어르신 관리 페이지
│   │   ├── [id]/       # 어르신 상세 페이지 (동적 라우트)
│   │   └── new/        # 새 어르신 등록 페이지
│   ├── sessions/       # 세션 관리 페이지
│   └── layout.tsx      # 대시보드 레이아웃 (인증 필요)
├── api/                # API Routes
│   ├── auth/           # 인증 관련 API
│   ├── elders/         # 어르신 관련 API
│   ├── sessions/       # 세션 관련 API
│   ├── messages/       # 메시지 관련 API
│   ├── biographies/    # 자서전 관련 API
│   └── risk-analysis/  # 위험도 분석 API
├── layout.tsx          # 루트 레이아웃
├── page.tsx            # 홈 페이지 (리다이렉트 또는 랜딩)
└── globals.css         # 전역 스타일
```

### `/lib` - 공용 라이브러리

재사용 가능한 유틸리티 함수와 클라이언트 설정

```
lib/
├── supabase/
│   ├── client.ts       # 브라우저용 Supabase 클라이언트
│   └── server.ts       # 서버 컴포넌트/API용 Supabase 클라이언트
├── openai.ts           # OpenAI 클라이언트 설정
├── utils/              # 유틸리티 함수 (향후 추가)
│   └── risk-analysis.ts  # 위험도 분석 로직
└── prompts/            # AI 프롬프트 템플릿 (향후 추가)
    ├── interview.ts    # 인터뷰 프롬프트
    └── biography.ts    # 자서전 생성 프롬프트
```

### `/types` - TypeScript 타입 정의

서버/클라이언트 공용 타입 정의

```
types/
├── database.ts         # Supabase DB 타입 (자동 생성 가능)
└── api.ts              # API 요청/응답 타입 (향후 추가)
```

### `/supabase` - 데이터베이스 관련

```
supabase/
└── migrations/
    └── 001_initial_schema.sql  # 초기 스키마 마이그레이션
```

## 주요 파일 설명

### `lib/supabase/client.ts`
- 브라우저에서 사용하는 Supabase 클라이언트
- 클라이언트 컴포넌트나 클라이언트 사이드 코드에서 사용
- `createClient()` 함수로 인스턴스 생성

### `lib/supabase/server.ts`
- 서버 컴포넌트나 API Route에서 사용하는 Supabase 클라이언트
- 쿠키를 통한 세션 관리 포함
- `createClient()` 함수로 인스턴스 생성 (async)

### `lib/openai.ts`
- OpenAI API 클라이언트 설정
- 환경변수 `OPENAI_API_KEY` 필요

### `types/database.ts`
- Supabase 데이터베이스의 타입 정의
- 실제 운영 시에는 Supabase CLI로 자동 생성 권장:
  ```bash
  npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
  ```

## 환경변수 설정

`.env.local` 파일에 다음 변수들을 설정해야 합니다:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-...

# Next.js (선택사항)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 데이터베이스 스키마 개요

### `elders` 테이블
어르신 프로필 정보를 저장합니다.
- `risk_level`: 현재 위험도 (low/medium/high)
- `last_session_at`: 마지막 대화 세션 시간

### `sessions` 테이블
각 인터뷰 세션을 저장합니다.
- `elder_id`: 어르신 ID (FK)
- `created_by`: 운영자 ID (FK → auth.users)
- `summary`: 세션 요약 (GPT 생성)
- `risk_level`: 세션에서 감지된 위험도

### `messages` 테이블
대화 메시지를 저장합니다.
- `session_id`: 세션 ID (FK)
- `role`: 'elder' 또는 'assistant'
- `emotion`: 감정 분석 결과
- `risk_score`: 위험도 점수 (0~1)

### `biographies` 테이블
자서전 데이터를 저장합니다.
- `elder_id`: 어르신 ID (FK)
- `version`: 버전 번호 (같은 어르신의 여러 버전 가능)
- `content`: 마크다운 형식의 자서전 내용

### `alerts` 테이블
위험도 알림을 저장합니다.
- `elder_id`: 어르신 ID (FK)
- `level`: 'medium' 또는 'high'
- `resolved_at`: 해결 처리 시간

## 보안 고려사항

### Row-Level Security (RLS)
모든 테이블에 RLS가 활성화되어 있으며, 인증된 사용자(운영자)만 접근 가능합니다.

### 민감 정보 처리
- 주민번호, 정확한 주소는 저장하지 않음
- 이름은 가명 가능
- 연락처는 선택적 필드

### 로그 및 에러 처리
- 실제 어르신의 민감 발화 내용이 외부 로그에 노출되지 않도록 주의
- 에러 메시지에서 민감 정보 제거

## 다음 단계

1. **Auth + 기본 Admin UI** 구현
2. **인터뷰 세션 UI** 구현
3. **음성 입력/출력** 통합
4. **위험도 분석** 로직 구현
5. **자서전 생성/편집** 기능 구현

각 단계별로 상세한 구현 가이드가 제공됩니다.
