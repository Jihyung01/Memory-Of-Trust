/**
 * 환경 변수 검증 (zod)
 *
 * 모든 process.env 접근은 이 파일을 통한다.
 * 컴포넌트/route handler 에서 process.env.* 직접 접근 금지.
 *
 *   import { env } from "@/lib/env";
 *   env.OPENAI_API_KEY
 */

import { z } from "zod";

const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // OpenAI
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_RESPONSE_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BATCH_MODEL: z.string().default("gpt-4o"),
  OPENAI_STT_MODEL: z.string().default("whisper-1"),

  // 네이버 클로바보이스
  NAVER_CLOVA_VOICE_CLIENT_ID: z.string().min(1),
  NAVER_CLOVA_VOICE_CLIENT_SECRET: z.string().min(1),
  NAVER_CLOVA_VOICE_VOICE_ID: z.string().default("vara"),

  // 카카오 알림톡 (Phase 1.5+, optional in dev)
  KAKAO_ALIMTALK_API_KEY: z.string().optional(),
  KAKAO_ALIMTALK_SENDER_KEY: z.string().optional(),

  // 토스페이먼츠 (Phase 2+, optional in dev)
  TOSS_PAYMENTS_CLIENT_KEY: z.string().optional(),
  TOSS_PAYMENTS_SECRET_KEY: z.string().optional(),

  // Cogno (Phase 2+, optional in dev)
  COGNO_BASE_URL: z.string().url().optional(),
  COGNO_API_KEY: z.string().optional(),
  COGNO_MODEL: z.string().default("qwen3.6:35b"),

  // 인증/Cron
  DEVICE_AUTH_SECRET: z.string().min(32, "DEVICE_AUTH_SECRET must be ≥32 chars"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be ≥16 chars"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

let cached: ServerEnv | null = null;

function loadServer(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    // 보안: 키 값을 출력하지 않는다. 어떤 키가 빠졌는지만 노출.
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `[env] Invalid or missing environment variables: ${missing}. See .env.example.`
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * 서버 환경 변수. 서버 코드(`app/api/*`, Server Actions, Server Components)에서만 사용.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_, key: string) {
    if (typeof window !== "undefined") {
      // 클라이언트에서 server env 접근 시 NEXT_PUBLIC_* 만 허용
      if (!key.startsWith("NEXT_PUBLIC_")) {
        throw new Error(
          `[env] '${key}' is server-only. Use clientEnv on the browser.`
        );
      }
    }
    return loadServer()[key as keyof ServerEnv];
  },
});

/**
 * 클라이언트 안전 env. NEXT_PUBLIC_* 만 노출.
 */
export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});
