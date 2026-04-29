/**
 * POST /api/dev/setup
 *
 * 개발 환경에서만 동작. 더미 어르신 + 디바이스를 생성하고
 * 테스트용 device_token을 반환.
 *
 * ⚠️ production에서는 403 반환.
 */

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEV_ELDER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_RAW_TOKEN = "dev";

function hashToken(raw: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(raw, "utf8")
    .digest("hex");
}

export async function POST() {
  const isDev = env.NODE_ENV !== "production" && env.ENABLE_DEV_PAGE === "true";
  if (!isDev) {
    return Response.json({ error: "Set ENABLE_DEV_PAGE=true in Vercel env vars" }, { status: 403 });
  }

  const db = getSupabaseServiceClient();
  const tokenHash = hashToken(DEV_RAW_TOKEN);

  // 1. 더미 어르신 확인/생성
  const { data: elder } = await db
    .from("elders")
    .select("id")
    .eq("id", DEV_ELDER_ID)
    .maybeSingle();

  if (!elder) {
    await db.from("elders").insert({
      id: DEV_ELDER_ID,
      name: "김순자",
      display_name: "어머님",
      birth_year: 1945,
      gender: "female",
      region: "서울",
      active: true,
    });
  }

  // 2. 디바이스 확인/생성
  const { data: device } = await db
    .from("devices")
    .select("id")
    .eq("device_token", tokenHash)
    .maybeSingle();

  if (!device) {
    await db.from("devices").insert({
      elder_id: DEV_ELDER_ID,
      device_token: tokenHash,
      model: "dev-browser",
    });
  }

  const response = NextResponse.json({
    elder_id: DEV_ELDER_ID,
    device_token: DEV_RAW_TOKEN,
    device_url: `/device/${DEV_RAW_TOKEN}`,
    family_url: `/family/${DEV_ELDER_ID}`,
    message: "Dev environment ready",
  });

  response.cookies.set("dev_elder_id", DEV_ELDER_ID, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
