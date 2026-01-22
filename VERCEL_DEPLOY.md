# Vercel 배포 가이드

## ✅ 완료된 작업

- ✅ GitHub 저장소 생성: https://github.com/Jihyung01/Memory-Of-Trust
- ✅ 코드 푸시 완료

## 🚀 Vercel 배포 단계

### 1단계: Vercel 계정 생성/로그인

1. [Vercel](https://vercel.com) 접속
2. **Sign Up** 클릭
3. **Continue with GitHub** 선택 (권장)
4. GitHub 계정으로 로그인

### 2단계: 프로젝트 Import

1. Vercel 대시보드에서 **Add New Project** 클릭
2. **Import Git Repository** 섹션에서
3. **Jihyung01 / Memory-Of-Trust** 저장소 찾기
4. **Import** 클릭

### 3단계: 프로젝트 설정

#### Framework 설정 (자동 감지됨)
- **Framework Preset**: Next.js ✅
- **Root Directory**: `./` (기본값 유지)
- **Build Command**: `npm run build` (기본값 유지)
- **Output Directory**: `.next` (기본값 유지)
- **Install Command**: `npm install` (기본값 유지)

### 4단계: 환경변수 설정 (⚠️ 매우 중요!)

**Environment Variables** 섹션에서 다음 3개 변수를 추가하세요:

#### 1. NEXT_PUBLIC_SUPABASE_URL
```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://xxxxx.supabase.co (본인의 Supabase 프로젝트 URL)
Environment: Production, Preview, Development 모두 선택
```

#### 2. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (본인의 Supabase Anon Key)
Environment: Production, Preview, Development 모두 선택
```

#### 3. OPENAI_API_KEY
```
Key: OPENAI_API_KEY
Value: sk-... (본인의 OpenAI API 키)
Environment: Production, Preview, Development 모두 선택
```

**환경변수 값 찾는 방법:**

**Supabase:**
1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. **Settings** → **API** 메뉴
4. **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`에 복사
5. **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 복사

**OpenAI:**
1. [OpenAI Platform](https://platform.openai.com/api-keys) 접속
2. **Create new secret key** 클릭
3. 생성된 키를 `OPENAI_API_KEY`에 복사

### 5단계: 배포 실행

1. 모든 환경변수 입력 확인
2. **Deploy** 버튼 클릭
3. 배포 진행 상황 확인 (2-3분 소요)

### 6단계: 배포 완료 확인

1. 배포 완료 후 제공되는 URL로 접속
   - 예: `https://memory-of-trust.vercel.app`
2. `/login` 페이지 확인
3. 로그인 테스트

## 📊 Supabase 데이터베이스 설정

### 마이그레이션 실행

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 클릭

#### 첫 번째 마이그레이션
1. `supabase/migrations/001_initial_schema.sql` 파일 내용 복사
2. SQL Editor에 붙여넣기
3. **Run** 버튼 클릭
4. 성공 메시지 확인

#### 두 번째 마이그레이션
1. `supabase/migrations/002_improve_schema.sql` 파일 내용 복사
2. SQL Editor에 붙여넣기
3. **Run** 버튼 클릭
4. 성공 메시지 확인

### Authentication 설정

1. **Authentication** → **Settings** 메뉴
2. **Email Auth** 활성화
3. **Site URL**에 Vercel 배포 URL 입력
   - 예: `https://memory-of-trust.vercel.app`
4. **Redirect URLs**에 추가:
   - `https://memory-of-trust.vercel.app/auth/callback`
5. **Save** 클릭

## ✅ 배포 체크리스트

배포 전:
- [ ] Vercel 계정 생성 완료
- [ ] GitHub 저장소 Import 완료
- [ ] 환경변수 3개 모두 설정 완료
- [ ] Supabase 마이그레이션 2개 실행 완료
- [ ] Supabase Authentication 설정 완료

배포 후 테스트:
- [ ] Vercel URL로 접속 성공
- [ ] 로그인 페이지 표시 확인
- [ ] 이메일 로그인 테스트
- [ ] 대시보드 접근 확인
- [ ] 어르신 등록 테스트
- [ ] 인터뷰 세션 테스트

## 🔄 자동 배포

GitHub에 코드를 푸시하면 Vercel이 자동으로 재배포합니다:

```powershell
git add .
git commit -m "Update: 변경사항"
git push
```

## 🐛 문제 해결

### 빌드 실패
- Vercel 대시보드 → **Deployments** → 실패한 배포 클릭
- **Logs** 탭에서 오류 확인
- 환경변수 누락 확인
- TypeScript 오류 확인

### 로그인 실패
- Supabase Site URL 확인
- Redirect URL 확인
- 환경변수 값 확인

### 데이터베이스 오류
- Supabase 마이그레이션 실행 확인
- RLS 정책 확인
- 연결 정보 확인

## 📞 도움말

- Vercel 문서: https://vercel.com/docs
- Supabase 문서: https://supabase.com/docs
- Next.js 문서: https://nextjs.org/docs

## 🎉 완료!

배포가 완료되면:
1. Vercel에서 제공하는 URL로 접속
2. 로그인하여 대시보드 사용
3. 어르신 등록 및 인터뷰 시작!
