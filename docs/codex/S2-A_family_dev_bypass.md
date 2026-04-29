# S2-A: 가족 대시보드 Dev Bypass

## 목표
개발 환경에서 Supabase Auth (Magic Link) 없이 가족 대시보드에 접근할 수 있도록 한다.

## 배경
현재 `/family/[elderId]` 페이지는 Supabase Auth 세션이 필요한데, 로컬 개발 시 Magic Link 인증 플로우를 매번 거치기 번거롭다. `/dev` 페이지에서 "가족 대시보드 열기" 클릭 시 바로 접근 가능해야 한다.

## 실행 계획

### 1. Dev 전용 인증 미들웨어 바이패스
**파일**: `middleware.ts` (또는 가족 레이아웃 내 auth 체크 로직)

- `NODE_ENV !== "production"` 또는 `ENABLE_DEV_PAGE === "true"` 일 때:
  - 쿠키에 `dev_elder_id` 값이 있으면 인증 통과 처리
  - 없으면 `/dev` 페이지로 리다이렉트

### 2. `/api/dev/setup` 응답에 dev 쿠키 설정
**파일**: `app/api/dev/setup/route.ts`

- 응답 시 `Set-Cookie: dev_elder_id=00000000-0000-0000-0000-000000000001; Path=/; HttpOnly; SameSite=Lax` 추가
- 이 쿠키가 있으면 가족 대시보드에서 해당 elder_id로 데이터 조회

### 3. 가족 대시보드 데이터 로딩 수정
**파일**: `app/(family)/family/[elderId]/FamilyDashboardClient.tsx`

- 기존: Supabase Auth 세션에서 user_id → family_links → elder_id 조회
- Dev 모드: 쿠키의 dev_elder_id와 URL의 elderId가 일치하면 바로 데이터 로딩

### 주의사항
- Production에서는 절대 바이패스 안 됨 (이중 가드: NODE_ENV + ENABLE_DEV_PAGE)
- RLS 정책은 변경하지 않음 — 서버 사이드에서 service role 클라이언트 사용
- dev 쿠키는 HttpOnly, 값은 elder_id UUID만

## 검증
1. `npm run dev` → `/dev` 접속 → "가족 대시보드 열기" 클릭
2. 인증 없이 가족 대시보드 로딩 확인
3. 발화 목록, 주간 카드 등 데이터 정상 표시 확인
4. `NODE_ENV=production`에서 쿠키 있어도 접근 차단 확인
