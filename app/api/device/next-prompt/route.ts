import { createHmac } from "node:crypto";

import { generateText } from "@/lib/ai/openai";
import { photoTriggerPrompt } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import {
  createPhotoPrompt,
  createPhotoSignedUrl,
  fetchDeviceByTokenHash,
  fetchElderById,
  fetchLeastShownActivePhoto,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const deviceToken = readDeviceToken(request);

    if (!deviceToken) {
      return Response.json({ error: "device_token is required" }, { status: 400 });
    }

    const device = await fetchDeviceByTokenHash(hashDeviceToken(deviceToken));

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

    if (!photo) {
      return Response.json({ error: "Active photo not found" }, { status: 404 });
    }

    const promptText = await generateText(
      photoTriggerPrompt({
        elderDisplayName: elder.display_name ?? elder.name,
        photoCaption: photo.caption ?? undefined,
        photoYear: photo.approximate_year ?? undefined,
        peopleInPhoto: photo.people_in_photo ?? undefined,
      })
    );

    const [prompt, photoUrl] = await Promise.all([
      createPhotoPrompt({
        elderId: device.elder_id,
        promptText,
        photoId: photo.id,
      }),
      createPhotoSignedUrl(photo.storage_path),
    ]);

    return Response.json({
      prompt_id: prompt.id,
      prompt_type: "photo_trigger",
      prompt_text: promptText,
      photo_url: photoUrl,
      photo_caption: photo.caption,
    });
  } catch (error) {
    console.error("GET /api/device/next-prompt error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
