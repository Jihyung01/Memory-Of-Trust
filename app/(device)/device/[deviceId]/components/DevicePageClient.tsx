"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isDevMode } from "@/lib/env";
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
  const [devTranscript, setDevTranscript] = useState<string>("");
  const [turnCount, setTurnCount] = useState(0);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<string>("");
  const processConversationRef = useRef<(blob: Blob, dur: number) => void>(() => {});

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

  const startRecording = useCallback(async () => {
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
              processConversationRef.current(result.blob, result.durationSec);
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
  }, []);

  const continueAfterTranscript = useCallback(
    async (input: {
      transcript: string;
      durationSec: number;
      startedAt: string;
      endedAt: string;
      audioBlob?: Blob;
    }) => {
      setPhase("processing");

      try {
        const utteranceForm = new FormData();
        if (input.audioBlob) {
          utteranceForm.append("audio", input.audioBlob, "recording.webm");
        }
        utteranceForm.append(
          "meta",
          JSON.stringify({
            device_token: deviceToken,
            transcript: input.transcript,
            audio_duration_sec: input.durationSec,
            prompt_id: prompt?.prompt_id ?? undefined,
            source_photo_id: undefined,
            started_at: input.startedAt,
            ended_at: input.endedAt,
          })
        );

        const utteranceStartedAt = Date.now();
        const utteranceRes = await fetch("/api/device/utterance", {
          method: "POST",
          body: utteranceForm,
        });
        console.log(`[device] utterance took ${Date.now() - utteranceStartedAt}ms`);

        if (!utteranceRes.ok) {
          console.error("Utterance save failed:", utteranceRes.status);
          setPhase("idle");
          return;
        }

        const utteranceData = (await utteranceRes.json()) as {
          utterance_id?: string;
          id?: string;
        };
        const utteranceId = utteranceData.utterance_id ?? utteranceData.id;
        if (!utteranceId) {
          console.error("Utterance response missing id");
          setPhase("idle");
          return;
        }

        const llmStartedAt = Date.now();
        const llmRes = await fetch("/api/llm/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utterance_id: utteranceId,
            turn_count: turnCount + 1,
          }),
        });
        console.log(`[device] llm/respond took ${Date.now() - llmStartedAt}ms`);

        if (!llmRes.ok) {
          console.error("LLM respond failed:", llmRes.status);
          setPhase("idle");
          return;
        }

        const llmData = (await llmRes.json()) as {
          response_text: string;
          should_end?: boolean;
        };
        setBubbleText(llmData.response_text);
        setTurnCount((prev) => prev + 1);

        setPhase("speaking");

        const ttsStartedAt = Date.now();
        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: llmData.response_text,
          }),
        });
        console.log(`[device] tts took ${Date.now() - ttsStartedAt}ms`);

        if (ttsRes.ok) {
          const ttsData = (await ttsRes.json()) as { audio_url?: string };
          if (!ttsData.audio_url) {
            console.error("TTS response missing audio_url");
            setPhase("idle");
            return;
          }

          console.log("[device] tts audio_url", ttsData.audio_url);
          const audio = new Audio(ttsData.audio_url);
          audioRef.current = audio;

          audio.onended = () => {
            audioRef.current = null;
            if (llmData.should_end) {
              setTurnCount(0);
              setPhase("idle");
              return;
            }

            startRecording();
          };
          audio.onerror = () => {
            audioRef.current = null;
            setPhase("idle");
          };

          await audio.play().catch(() => {
            console.log("[device] audio playback skipped", ttsData.audio_url);
            if (llmData.should_end) {
              setTurnCount(0);
            }
            setPhase("idle");
          });
        } else {
          console.error("TTS failed:", ttsRes.status);
          if (llmData.should_end) {
            setTurnCount(0);
          }
          setPhase("idle");
        }
      } catch (error) {
        console.error("Conversation processing error:", error);
        setPhase("idle");
      }
    },
    [deviceToken, prompt, startRecording, turnCount]
  );

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

        await continueAfterTranscript({
          transcript: sttData.transcript,
          durationSec,
          startedAt: startedAtRef.current,
          endedAt,
          audioBlob,
        });
      } catch (error) {
        console.error("Conversation processing error:", error);
        setPhase("idle");
      }
    },
    [continueAfterTranscript, deviceToken]
  );

  useEffect(() => {
    processConversationRef.current = processConversation;
  }, [processConversation]);

  const handleDevSubmit = useCallback(async () => {
    const transcript = devTranscript.trim();
    if (!isDevMode || !transcript || phase === "processing" || phase === "speaking") {
      return;
    }

    const startedAt = new Date().toISOString();
    const endedAt = new Date().toISOString();
    setDevTranscript("");
    await continueAfterTranscript({
      transcript,
      durationSec: 0,
      startedAt,
      endedAt,
    });
  }, [continueAfterTranscript, devTranscript, phase]);

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
      await startRecording();
    }
  }, [phase, processConversation, startRecording]);

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
        {isDevMode ? (
          <form
            className="fixed bottom-3 right-3 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded border border-neutral-400 bg-neutral-100 p-3 text-xs opacity-50 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              handleDevSubmit();
            }}
          >
            <label className="text-neutral-700" htmlFor="dev-transcript">
              [dev] 발화 시뮬레이션
            </label>
            <textarea
              id="dev-transcript"
              className="min-h-16 resize-none rounded border border-neutral-300 bg-white p-2 text-sm text-neutral-900"
              value={devTranscript}
              onChange={(event) => setDevTranscript(event.target.value)}
            />
            <button
              type="submit"
              className="rounded border border-neutral-500 px-3 py-2 text-neutral-800 disabled:opacity-40"
              disabled={!devTranscript.trim() || phase === "processing" || phase === "speaking"}
            >
              [dev] 발화 전송
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
