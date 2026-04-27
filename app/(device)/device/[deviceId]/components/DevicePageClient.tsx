"use client";

import { useCallback, useEffect, useState } from "react";

import { ko } from "@/lib/i18n";

import { BigClock } from "./BigClock";
import { MicButton } from "./MicButton";
import { PhotoFrame } from "./PhotoFrame";
import { PromptBubble } from "./PromptBubble";

interface DevicePageClientProps {
  deviceToken: string;
}

interface NextPromptResponse {
  prompt_id: string;
  prompt_type: "photo_trigger";
  prompt_text: string;
  photo_url: string;
  photo_caption: string | null;
}

export function DevicePageClient({ deviceToken }: DevicePageClientProps) {
  const [prompt, setPrompt] = useState<NextPromptResponse | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchNextPrompt() {
      try {
        const response = await fetch(
          `/api/device/next-prompt?device_token=${encodeURIComponent(deviceToken)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as NextPromptResponse;

        if (isMounted) {
          setPrompt(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("device prompt fetch failed:", error);
        }
      }
    }

    fetchNextPrompt();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [deviceToken]);

  const handleMicPress = useCallback(() => {
    setIsMicActive((current) => {
      const next = !current;
      console.log("device mic visual toggle:", next);
      return next;
    });
  }, []);

  return (
    <main className="fixed inset-0 flex min-h-screen flex-col overflow-hidden bg-amber-50 text-stone-800">
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] px-6 py-6 sm:px-10 lg:grid-cols-[minmax(220px,320px)_1fr] lg:grid-rows-[1fr_auto] lg:gap-x-8 lg:px-12 lg:py-10">
        <section className="flex items-start justify-center lg:row-span-2 lg:justify-start">
          <BigClock />
        </section>

        <section className="flex min-h-0 flex-col items-center justify-center gap-6 py-6 lg:py-4">
          <PhotoFrame
            caption={prompt?.photo_caption ?? null}
            photoUrl={prompt?.photo_url ?? null}
          />
          <PromptBubble text={prompt?.prompt_text ?? ko.elder.promptFallback} />
        </section>

        <section className="flex items-center justify-center pb-2 lg:col-start-2">
          <MicButton isActive={isMicActive} onPress={handleMicPress} />
        </section>
      </div>
    </main>
  );
}
