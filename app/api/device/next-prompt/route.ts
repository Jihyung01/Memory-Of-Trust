import { createHmac } from "node:crypto";

import { generateText, OpenAIAuthError } from "@/lib/ai/openai";
import { photoTriggerPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  createPhotoPrompt,
  createPhotoSignedUrl,
  type DeviceAuthRecord,
  fetchDeviceByRawTokenDev,
  fetchDeviceByTokenHash,
  fetchElderById,
  fetchLeastShownActivePhoto,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NEXT_PROMPT_FALLBACK_TEXT = "어머님, 이 사진 어디서 찍으셨어요?";
const NEXT_PROMPT_TIMEOUT_MS =
  env.NODE_ENV === "production" ? 15_000 : 4_500;

function hashDeviceToken(deviceToken: string): string {
  return createHmac("sha256", env.DEVICE_AUTH_SECRET)
    .update(deviceToken, "utf8")
    .digest("hex");
}

function readDeviceToken(request: Request): string | null {
  const url = new URL(request.url);
  const token = url.searchParams.get("device_token");

  if (!token || token.length > 512) {
    return null;
  }

  return token;
}

async function fetchDeviceForToken(deviceToken: string): Promise<DeviceAuthRecord | null> {
  const device = await fetchDeviceByTokenHash(hashDeviceToken(deviceToken));
  if (device || env.NODE_ENV === "production") return device;

  // TODO: Phase 2 진입 시 모든 device_token 을 HMAC 으로 통일하고 이 폴백 제거
  const devDevice = await fetchDeviceByRawTokenDev(deviceToken);
  if (devDevice) {
    console.warn(`[dev] using raw token fallback for device ${devDevice.id}`);
  }
  return devDevice;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

export async function GET(request: Request) {
  try {
    const deviceToken = readDeviceToken(request);

    if (!deviceToken) {
      return Response.json({ error: "device_token is required" }, { status: 400 });
    }

    const device = await fetchDeviceForToken(deviceToken);

    if (!device) {
      return Response.json({ error: "Invalid device token" }, { status: 401 });
    }

    const [elder, photo] = await Promise.all([
      fetchElderById(device.elder_id),
      fetchLeastShownActivePhoto(device.elder_id),
    ]);

    if (!elder) {
      return Response.json({ error: "Elder not found" }, { status: 404 });
    }

    // 사진이 없어도 기본 프롬프트로 동작
    let promptText = NEXT_PROMPT_FALLBACK_TEXT;
    const llmStartedAt = Date.now();
    console.log("[next-prompt] generateText start");

    try {
      promptText = await generateText({
        prompt: photoTriggerPrompt({
          elderDisplayName: elder.display_name ?? elder.name,
          photoCaption: photo?.caption ?? undefined,
          photoYear: photo?.approximate_year ?? undefined,
          peopleInPhoto: photo?.people_in_photo ?? undefined,
        }),
        timeoutMs: NEXT_PROMPT_TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof OpenAIAuthError) {
        console.error("OpenAI auth failed in next-prompt:", error);
        if (env.NODE_ENV !== "production") {
          return Response.json(
            {
              error: "OpenAI auth failed",
              hint: "check OPENAI_API_KEY in .env.local",
            },
            { status: 401 }
          );
        }
        return Response.json({ error: "Internal server error" }, { status: 500 });
      }

      if (isTimeoutError(error)) {
        console.warn("[next-prompt] generateText timed out; using fallback prompt");
      } else {
        console.warn("[next-prompt] generateText failed; using fallback prompt", error);
      }
    } finally {
      console.log(`[next-prompt] generateText took ${Date.now() - llmStartedAt}ms`);
    }

    const prompt = await createPhotoPrompt({
      elderId: device.elder_id,
      promptText,
      photoId: photo?.id ?? null,
    });

    // 사진 signed URL — Storage에 파일이 없어도 에러 안 남
    let photoUrl: string | null = null;
    if (photo) {
      try {
        photoUrl = await createPhotoSignedUrl(photo.storage_path);
      } catch (err) {
        console.warn("Photo signed URL failed (non-fatal):", err);
      }
    }

    return Response.json({
      prompt_id: prompt.id,
      prompt_type: "photo_trigger",
      prompt_text: promptText,
      photo_url: photoUrl,
      photo_caption: photo?.caption ?? null,
    });
  } catch (error) {
    console.error("GET /api/device/next-prompt error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
