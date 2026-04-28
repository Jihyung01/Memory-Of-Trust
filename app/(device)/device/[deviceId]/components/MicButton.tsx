"use client";

import { ko } from "@/lib/i18n";

interface MicButtonProps {
  isActive: boolean;
  isProcessing?: boolean;
  onPress: () => void;
}

/** 마이크 SVG 아이콘 */
function MicIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

/** 스피커 도트 그릴 */
function SpeakerGrill() {
  return (
    <div
      className="grid gap-1 opacity-40"
      style={{ gridTemplateColumns: "repeat(8, 6px)" }}
      aria-hidden
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--radio-dot)" }}
        />
      ))}
    </div>
  );
}

export function MicButton({ isActive, isProcessing = false, onPress }: MicButtonProps) {
  const disabled = isProcessing;

  let label: string;
  if (isProcessing) {
    label = ko.elder.listening;
  } else if (isActive) {
    label = ko.elder.micStop;
  } else {
    label = ko.elder.micStart;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 스피커 그릴 */}
      <SpeakerGrill />

      {/* 버튼 패널 */}
      <div
        className="flex items-center justify-center gap-6 rounded-2xl border-2 px-8 py-5"
        style={{
          background: "var(--radio-bezel)",
          borderColor: "var(--radio-border)",
        }}
      >
        {/* 소리 보조 버튼 */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-opacity"
          style={{
            background: "var(--radio-panel)",
            borderColor: "var(--radio-border)",
            opacity: isActive ? 0.4 : 0.7,
          }}
          tabIndex={-1}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--radio-text-dim)"
            strokeWidth="2"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="m15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        </button>

        {/* 메인 마이크 버튼 */}
        <div className="relative flex flex-col items-center gap-2">
          {/* 녹음 중 펄스 링 */}
          {isActive && (
            <>
              <div
                className="absolute rounded-full"
                style={{
                  width: 108,
                  height: 108,
                  top: -10,
                  left: "50%",
                  marginLeft: -54,
                  border: "2px solid rgba(255,100,60,0.2)",
                  animation: "pulse-ring 1.5s ease-out infinite",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: 108,
                  height: 108,
                  top: -10,
                  left: "50%",
                  marginLeft: -54,
                  border: "2px solid rgba(255,100,60,0.15)",
                  animation: "pulse-ring 1.5s ease-out infinite 0.5s",
                }}
              />
            </>
          )}

          <button
            type="button"
            aria-pressed={isActive}
            disabled={disabled}
            onClick={onPress}
            className="relative z-10 flex h-22 w-22 items-center justify-center rounded-full border-3 transition-transform duration-200"
            style={{
              background: isActive
                ? "radial-gradient(circle at 40% 35%, #ff6a3c, #cc4420)"
                : isProcessing
                  ? "radial-gradient(circle at 40% 35%, #6a6a70, #4a4a50)"
                  : "radial-gradient(circle at 40% 35%, #e8a040, #c87820)",
              borderColor: isActive
                ? "#ff8a50"
                : isProcessing
                  ? "#5a5a60"
                  : "#a07040",
              animation: isActive
                ? "mic-glow 1.5s ease-in-out infinite"
                : isProcessing
                  ? "none"
                  : "pulse-glow 3s ease-in-out infinite",
              cursor: disabled ? "default" : "pointer",
              transform: disabled ? "none" : undefined,
            }}
          >
            <MicIcon color={isActive ? "#fff" : isProcessing ? "#999" : "#2a2a2d"} />
          </button>

          <span
            className="text-lg"
            style={{
              color: isActive
                ? "var(--radio-rec)"
                : isProcessing
                  ? "var(--radio-text-dim)"
                  : "var(--radio-text)",
            }}
          >
            {label}
          </span>
        </div>

        {/* 알림 보조 버튼 */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 transition-opacity"
          style={{
            background: "var(--radio-panel)",
            borderColor: "var(--radio-border)",
            opacity: isActive ? 0.4 : 0.7,
          }}
          tabIndex={-1}
          aria-hidden
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--radio-text-dim)"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
