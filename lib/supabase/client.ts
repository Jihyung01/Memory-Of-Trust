"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          // magic link hash 자동 처리 보장
          detectSessionInUrl: true,
          flowType: "implicit",
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
  }

  return browserClient;
}
