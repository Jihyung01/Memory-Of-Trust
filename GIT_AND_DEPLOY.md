# Git 커밋 및 배포 완료 가이드

## ✅ 완료된 작업

1. ✅ Git 저장소 초기화
2. ✅ 모든 파일 커밋 완료 (45개 파일, 10,115줄 추가)

## 📤 다음 단계: GitHub에 푸시하기

### 1단계: GitHub 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단의 **+** 버튼 클릭 → **New repository**
3. 저장소 정보 입력:
   - **Repository name**: `mot-care-mvp`
   - **Description**: `AI 상담형 고령인구 돌봄 케어 시스템 MVP`
   - **Public** 또는 **Private** 선택 (Private 권장)
   - **Initialize this repository with** 체크박스는 모두 해제
4. **Create repository** 클릭

### 2단계: 로컬에서 GitHub로 푸시

GitHub에서 저장소를 만든 후, 다음 명령어를 실행하세요:

```powershell
# 프로젝트 폴더로 이동 (이미 있다면 생략)
cd C:\Users\tbvj1\mot-care-mvp

# GitHub에서 제공하는 URL로 원격 저장소 추가
# YOUR_USERNAME을 본인의 GitHub 사용자명으로 변경하세요
git remote add origin https://github.com/YOUR_USERNAME/mot-care-mvp.git

# 브랜치 이름을 main으로 변경
git branch -M main

# 코드 푸시
git push -u origin main
```

**GitHub 인증이 필요할 수 있습니다:**
- Personal Access Token 사용 권장
- 또는 GitHub Desktop 사용

### 3단계: Vercel 배포

#### Vercel 계정 생성
1. [Vercel](https://vercel.com) 접속
2. **Sign Up** → GitHub 계정으로 가입 (권장)

#### 프로젝트 배포
1. Vercel 대시보드에서 **Add New Project** 클릭
2. **Import Git Repository** 선택
3. GitHub 저장소 `mot-care-mvp` 선택
4. **Import** 클릭

#### 프로젝트 설정
1. **Framework Preset**: Next.js (자동 감지)
2. **Root Directory**: `./` (기본값 유지)
3. **Build Command**: `npm run build` (기본값 유지)
4. **Output Directory**: `.next` (기본값 유지)

#### 환경변수 설정 (중요!)
**Environment Variables** 섹션에서 다음 변수들을 추가하세요:

```
NEXT_PUBLIC_SUPABASE_URL
= your_supabase_project_url

NEXT_PUBLIC_SUPABASE_ANON_KEY
= your_supabase_anon_key

OPENAI_API_KEY
= your_openai_api_key
```

각 변수는:
- **Key**: 변수 이름 (예: `NEXT_PUBLIC_SUPABASE_URL`)
- **Value**: 실제 값 (Supabase/OpenAI에서 가져온 값)
- **Environment**: Production, Preview, Development 모두 선택

#### 배포 실행
1. **Deploy** 버튼 클릭
2. 배포 완료까지 2-3분 소요
3. 배포 완료 후 제공되는 URL로 접속 가능

## 🔧 Supabase 데이터베이스 설정

### 마이그레이션 실행
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 클릭
5. 다음 파일 내용을 순서대로 복사하여 실행:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_improve_schema.sql`
6. 각 쿼리 실행 후 **Run** 버튼 클릭

### Authentication 설정
1. **Authentication** → **Settings** 메뉴
2. **Email Auth** 활성화
3. **Site URL**에 Vercel 배포 URL 입력

## 📋 체크리스트

배포 전 확인사항:
- [ ] GitHub 저장소 생성 완료
- [ ] 코드 푸시 완료
- [ ] Vercel 계정 생성 완료
- [ ] Vercel 프로젝트 생성 완료
- [ ] 환경변수 3개 모두 설정 완료
- [ ] Supabase 마이그레이션 실행 완료
- [ ] Supabase Authentication 설정 완료

## 🎉 배포 완료 후

1. Vercel에서 제공하는 URL로 접속
2. `/login` 페이지 확인
3. 이메일로 로그인 테스트
4. 대시보드 접근 확인
5. 어르신 등록 테스트
6. 인터뷰 세션 테스트

## 🔄 업데이트 배포

코드를 수정한 후 다시 배포하려면:

```powershell
git add .
git commit -m "Update: 변경사항 설명"
git push
```

Vercel이 자동으로 재배포합니다!

## ❓ 문제 해결

### Git 푸시 오류
- GitHub 인증 확인
- Personal Access Token 사용
- 또는 GitHub Desktop 사용

### Vercel 빌드 실패
- 환경변수 확인
- Vercel 로그 확인
- TypeScript 오류 확인

### 데이터베이스 연결 실패
- Supabase URL과 키 확인
- RLS 정책 확인
- 네트워크 연결 확인

## 📞 도움말

- Vercel 문서: https://vercel.com/docs
- Supabase 문서: https://supabase.com/docs
- Next.js 문서: https://nextjs.org/docs
