import { createClient } from './supabase/server'

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 * 서버 컴포넌트에서만 사용 가능합니다.
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * 로그아웃 처리
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
