"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ko } from "@/lib/i18n";
import { VoiceRecorder } from "@/lib/voice/recorder";

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

type ConversationPhase =
  | "idle"
  | "recording"
  | "processing"
  | "speaking";

export function DevicePageClient({ deviceToken }: DevicePageClientProps) {
  const [prompt, setPrompt] = useState<NextPromptResponse | null>(null);
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [bubbleText, setBubbleText] = useState<string>("");

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<string>("");

  // 다음 프롬프트 가져오기
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchNextPrompt() {
      try {
        const response = await fetch(
          `/api/device/next-prompt?device_token=${encodeURIComponent(deviceToken)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok) return;
        const data = (await response.json()) as NextPromptResponse;
        if (isMounted) {
          setPrompt(data);
          setBubbleText(data.prompt_text);
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

  useEffect(() => {
    return () => {
      recorderRef.current?.dispose();
    };
  }, []);

  const processConversation = useCallback(
    async (audioBlob: Blob, durationSec: number) => {
      setPhase("processing");
      const endedAt = new Date().toISOString();

      try {
        const sttForm = new FormData();
        sttForm.append("audio", audioBlob, "recording.webm");
        sttForm.append("device_token", deviceToken);

        const sttRes = await fetch("/api/stt", {
          method: "POST",
          body: sttForm,
        });

        if (!sttRes.ok) {
          console.error("STT failed:", sttRes.status);
          setPhase("idle");
          return;
        }

        const sttData = (await sttRes.json()) as {
          transcript: string;
          filtered: boolean;
          elder_id: string;
        };

        if (sttData.filtered || !sttData.transcript) {
          setPhase("idle");
          return;
        }

        const utteranceForm = new FormData();
        utteranceForm.append("audio", audioBlob, "recording.webm");
        utteranceForm.append(
          "meta",
          JSON.stringify({
            device_token: deviceToken,
            transcript: sttData.transcript,
            audio_duration_sec: durationSec,
            prompt_id: prompt?.prompt_id ?? undefined,
            source_photo_id: undefined,
            started_at: startedAtRef.current,
            ended_at: endedAt,
          })
        );

        const savePromise = fetch("/api/device/utterance", {
          method: "POST",
          body: utteranceForm,
        }).catch((err) => console.error("Utterance save failed:", err));

        const llmRes = await fetch("/api/llm/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_token: deviceToken,
            transcript: sttData.transcript,
            prompt_text: prompt?.prompt_text ?? undefined,
          }),
        });

        await savePromise;

        if (!llmRes.ok) {
          console.error("LLM respond failed:", llmRes.status);
          setPhase("idle");
          return;
        }

        const llmData = (await llmRes.json()) as { response_text: string };
        setBubbleText(llmData.response_text);

        setPhase("speaking");

        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_token: deviceToken,
            text: llmData.response_text,
          }),
        });

        if (ttsRes.ok) {
          const mp3Blob = await ttsRes.blob();
          const audioUrl = URL.createObjectURL(mp3Blob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            setPhase("idle");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            setPhase("idle");
          };

          await audio.play().catch(() => {
            URL.revokeObjectURL(audioUrl);
            setPhase("idle");
          });
        } else {
          console.error("TTS failed:", ttsRes.status);
          setPhase("idle");
        }
      } catch (error) {
        console.error("Conversation processing error:", error);
        setPhase("idle");
      }
    },
    [deviceToken, prompt]
  );

  const handleMicPress = useCallback(async () => {
    if (phase === "processing" || phase === "speaking") return;

    if (phase === "recording") {
      try {
        const result = await recorderRef.current?.stop();
        if (result && result.durationSec >= 0.5) {
          processConversation(result.blob, result.durationSec);
        } else {
          setPhase("idle");
        }
      } catch {
        setPhase("idle");
      }
    } else {
      try {
        if (!recorderRef.current) {
          recorderRef.current = new VoiceRecorder();
        }
        startedAtRef.current = new Date().toISOString();

        await recorderRef.current.start({
          silenceThreshold: 15,
          silenceDurationMs: 4000,
          maxDurationMs: 60000,
          onAutoStop: async () => {
            try {
              const result = await recorderRef.current?.stop();
              if (result && result.durationSec >= 0.5) {
                processConversation(result.blob, result.durationSec);
              } else {
                setPhase("idle");
              }
            } catch {
              setPhase("idle");
            }
          },
        });
        setPhase("recording");
      } catch (error) {
        console.error("Mic start failed:", error);
        setPhase("idle");
      }
    }
  }, [phase, processConversation]);

  return (
    <main
      className="fixed inset-0 flex min-h-screen flex-col overflow-hidden"
      style={{ background: "var(--radio-body)" }}
    >
      {/* 상단 바 */}
      <header
        className="flex items-center justify-between border-b-2 px-6 py-3"
        style={{
          background: "var(--radio-bezel)",
          borderColor: "var(--radio-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border-2"
            style={{
              background: "radial-gradient(circle, #8a8880, #5a5a5e)",
              borderColor: "var(--radio-border)",
            }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--radio-body)" }}>
              M
            </span>
          </div>
          <span
            className="text-sm tracking-widest"
            style={{ color: "var(--radio-text-dim)" }}
          >
            MOT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: phase === "recording" ? "var(--radio-rec)" : "#7ab87a",
              animation:
                phase === "recording"
                  ? "dot-blink 1s ease-in-out infinite"
                  : "breathe 3s ease-in-out infinite",
            }}
          />
          <span className="text-xs" style={{ color: "var(--radio-text-dim)" }}>
            {phase === "recording" ? "듣는 중" : "연결됨"}
          </span>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col items-center justify-between gap-4 overflow-hidden px-6 py-4">
        <BigClock />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <PhotoFrame
            caption={prompt?.photo_caption ?? null}
            photoUrl={prompt?.photo_url ?? null}
          />
          <PromptBubble
            text={
              phase === "recording"
                ? "말씀하세요, 듣고 있어요"
                : phase === "processing"
                  ? "..."
                  : bubbleText || ko.elder.promptFallback
            }
            isRecording={phase === "recording"}
          />
        </div>

        <MicButton
          isActive={phase === "recording"}
          isProcessing={phase === "processing" || phase === "speaking"}
          onPress={handleMicPress}
        />
      </div>
    </main>
  );
}
