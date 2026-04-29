/**
 * 개발용 시드 데이터 생성 스크립트
 *
 * .env.local의 키를 읽어서 디바이스 토큰을 HMAC 해시로 변환 후
 * Supabase에 어르신 + 디바이스를 INSERT.
 *
 * 실행: node scripts/seed-dev.mjs
 */

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local 읽기
function loadEnvLocal() {
  const envContent = readFileSync(".env.local", "utf8");
  const vars = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // 따옴표 제거
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const env = loadEnvLocal();

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_SECRET = env.DEVICE_AUTH_SECRET;

if (!SUPABASE_URL || !SERVICE_KEY || !AUTH_SECRET) {
  console.error("❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEVICE_AUTH_SECRET 필요");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 데모 토큰 (URL에서 사용할 평문)
const DEMO_TOKEN = "demo-device-001";

// HMAC 해시 (DB에 저장할 값)
const tokenHash = createHmac("sha256", AUTH_SECRET)
  .update(DEMO_TOKEN, "utf8")
  .digest("hex");

const ELDER_ID = "00000000-0000-0000-0000-000000000001";
const DEVICE_ID = "00000000-0000-0000-0000-000000000100";

async function seed() {
  console.log("🌱 시드 데이터 생성 중...");
  console.log(`   디바이스 토큰(평문): ${DEMO_TOKEN}`);
  console.log(`   디바이스 토큰(해시): ${tokenHash.slice(0, 16)}...`);

  // 1) 어르신
  const { error: elderErr } = await db
    .from("elders")
    .upsert({
      id: ELDER_ID,
      name: "이복순",
      display_name: "어머님",
      birth_year: 1944,
      gender: "female",
      region: "경상북도",
      voice_persona: "손주 같은 작가",
      active: true,
    }, { onConflict: "id" });

  if (elderErr) {
    console.error("❌ 어르신 INSERT 실패:", elderErr.message);
    return;
  }
  console.log("✅ 어르신: 이복순 (어머님)");

  // 2) 디바이스
  const { error: deviceErr } = await db
    .from("devices")
    .upsert({
      id: DEVICE_ID,
      elder_id: ELDER_ID,
      device_token: tokenHash,
      model: "dev-browser",
      last_active_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (deviceErr) {
    console.error("❌ 디바이스 INSERT 실패:", deviceErr.message);
    return;
  }
  console.log("✅ 디바이스 등록 완료");

  // 3) 데모 사진 1장 (캡션만, 실제 이미지는 없어도 OK)
  const { error: photoErr } = await db
    .from("photos")
    .upsert({
      id: "00000000-0000-0000-0000-000000000200",
      elder_id: ELDER_ID,
      storage_path: "demo/sample-photo.jpg",
      caption: "결혼식 날, 1968년",
      approximate_year: 1968,
      people_in_photo: ["이복순", "김영철"],
      active: true,
      shown_count: 0,
    }, { onConflict: "id" });

  if (photoErr) {
    console.error("⚠️  사진 INSERT 실패 (무시 가능):", photoErr.message);
  } else {
    console.log("✅ 데모 사진 1장 등록");
  }

  console.log("");
  console.log("🎉 완료! 브라우저에서 접속:");
  console.log(`   http://localhost:3000/device/${DEMO_TOKEN}`);
  console.log("");
}

seed().catch(console.error);
