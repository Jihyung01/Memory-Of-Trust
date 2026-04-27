import { HomePageClient } from './home-page-client';

/** 서버 페이지로 두어 클라이언트에 params/searchParams Promise가 전달되지 않게 함 (devtools 직렬화 경고 방지) */
export default function Page() {
  return <HomePageClient />;
}
