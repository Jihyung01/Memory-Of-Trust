import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import {
  type DeviceAuthRecord,
  fetchDeviceByRawTokenDev,
  fetchDeviceByTokenHash,
  touchDeviceLastActive,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface DeviceAuthRequest {
  device_token?: unknown;
}

function hashDeviceToken(deviceToken: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(deviceToken, "utf8")
    .digest("hex");
}

function signSessionToken(input: { deviceId: string; elderId: string }): string {
  const payload = Buffer.from(
    JSON.stringify({
      device_id: input.deviceId,
      elder_id: input.elderId,
      issued_at: new Date().toISOString(),
    }),
    "utf8"
  ).toString("base64url");

  const signature = createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(payload, "utf8")
    .digest("base64url");

  return `${payload}.${signature}`;
}

function isSafeTokenString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512;
}

async function fetchDeviceForToken(deviceToken: string): Promise<DeviceAuthRecord | null> {
  const tokenHash = hashDeviceToken(deviceToken);
  const device = await fetchDeviceByTokenHash(tokenHash);
  if (device || env.NODE_ENV === "production") return device;

  // TODO: Phase 2 진입 시 모든 device_token 을 HMAC 으로 통일하고 이 폴백 제거
  const devDevice = await fetchDeviceByRawTokenDev(deviceToken);
  if (devDevice) {
    console.warn(`[dev] using raw token fallback for device ${devDevice.id}`);
  }
  return devDevice;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeviceAuthRequest;

    if (!isSafeTokenString(body.device_token)) {
      return Response.json({ error: "device_token is required" }, { status: 400 });
    }

    const device = await fetchDeviceForToken(body.device_token);

    if (!device) {
      return Response.json({ error: "Invalid device token" }, { status: 401 });
    }

    await touchDeviceLastActive(device.id);

    return Response.json({
      elder_id: device.elder_id,
      session_token: signSessionToken({
        deviceId: device.id,
        elderId: device.elder_id,
      }),
    });
  } catch (error) {
    console.error("POST /api/device/auth error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
