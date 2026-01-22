# 배포 가이드

## 🚀 Vercel 배포

### 1. GitHub에 코드 푸시

먼저 GitHub에 원격 저장소를 만들고 코드를 푸시해야 합니다.

#### GitHub 저장소 생성
1. [GitHub](https://github.com)에 로그인
2. 우측 상단의 **+** 버튼 클릭 → **New repository**
3. 저장소 이름: `mot-care-mvp` (또는 원하는 이름)
4. **Public** 또는 **Private** 선택
5. **Create repository** 클릭

#### 로컬에서 푸시
```bash
# 원격 저장소 추가 (GitHub에서 제공하는 URL 사용)
git remote add origin https://github.com/YOUR_USERNAME/mot-care-mvp.git

# 메인 브랜치로 변경
git branch -M main

# 코드 푸시
git push -u origin main
```

### 2. Vercel 배포

#### Vercel 계정 생성 및 로그인
1. [Vercel](https://vercel.com)에 가입/로그인
2. GitHub 계정으로 연동 권장

#### 프로젝트 배포
1. Vercel 대시보드에서 **Add New Project** 클릭
2. GitHub 저장소 선택 (`mot-care-mvp`)
3. **Import** 클릭
4. 프로젝트 설정:
   - **Framework Preset**: Next.js (자동 감지됨)
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `.next` (기본값)
5. **Environment Variables** 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```
6. **Deploy** 클릭

### 3. Supabase 데이터베이스 설정

#### 마이그레이션 실행
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. **SQL Editor** 메뉴 클릭
4. `supabase/migrations/001_initial_schema.sql` 내용 복사하여 실행
5. `supabase/migrations/002_improve_schema.sql` 내용 복사하여 실행

#### Authentication 설정
1. **Authentication** → **Settings** 메뉴
2. **Email Auth** 활성화
3. **Site URL** 설정 (Vercel 배포 URL)

## 📝 환경변수 설정

### 로컬 개발
`.env.local` 파일 생성:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...
```

### Vercel 배포
Vercel 대시보드 → Project Settings → Environment Variables에서 설정

## 🔗 도메인 설정 (선택사항)

1. Vercel 대시보드 → Project Settings → Domains
2. 원하는 도메인 추가
3. DNS 설정 안내에 따라 도메인 연결

## 📊 배포 확인

배포 완료 후:
1. Vercel에서 제공하는 URL로 접속
2. `/login` 페이지 확인
3. 로그인 테스트
4. 대시보드 접근 확인

## 🔄 자동 배포

GitHub에 푸시하면 자동으로 Vercel에서 재배포됩니다:
```bash
git add .
git commit -m "Update: 변경사항"
git push
```

## ⚠️ 주의사항

1. **환경변수 보안**: `.env.local`은 절대 Git에 커밋하지 마세요
2. **API 키 관리**: Vercel 환경변수에 올바르게 설정되었는지 확인
3. **Supabase RLS**: 프로덕션 환경에서는 RLS 정책을 더 세밀하게 설정하세요

## 🐛 문제 해결

### 빌드 실패
- Vercel 로그 확인
- 환경변수 누락 확인
- TypeScript 오류 확인

### 데이터베이스 연결 실패
- Supabase URL과 키 확인
- RLS 정책 확인
- 네트워크 연결 확인
