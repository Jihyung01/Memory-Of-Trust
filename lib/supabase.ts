/**
 * MOT — Supabase 클라이언트
 *
 * 서버용 (service role) / 클라이언트용 (anon) 분리.
 * API Route에서는 getSupabaseAdmin()을 사용하고,
 * 브라우저에서는 getSupabaseClient()를 사용합니다.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ── 싱글턴 캐시 ──────────────────────────────────────
let _adminClient: SupabaseClient | null = null;
let _publicClient: SupabaseClient | null = null;

/**
 * 서버 전용 — service_role 키로 RLS를 우회.
 * API Route (route.ts) 에서만 사용할 것.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return _adminClient;
}

/**
 * 클라이언트 (브라우저) 전용 — anon key, RLS 적용.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_publicClient) {
    _publicClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _publicClient;
}
