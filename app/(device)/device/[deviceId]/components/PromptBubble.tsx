interface PromptBubbleProps {
  text: string;
  isRecording?: boolean;
}

export function PromptBubble({ text, isRecording = false }: PromptBubbleProps) {
  return (
    <div
      className="max-w-md rounded-2xl border-2 px-8 py-5 text-center"
      style={{
        background: isRecording
          ? "rgba(183, 95, 42, 0.10)"
          : "var(--radio-accent-dim)",
        borderColor: isRecording
          ? "rgba(183, 95, 42, 0.26)"
          : "rgba(49, 95, 105, 0.18)",
        boxShadow: "0 10px 24px rgba(63, 48, 30, 0.08)",
      }}
    >
      {/* 녹음 중 파형 */}
      {isRecording && (
        <div className="mb-3 flex items-end justify-center gap-1" style={{ height: 28 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-sm"
              style={{
                height: 28,
                background: "linear-gradient(180deg, var(--radio-rec), var(--radio-accent))",
                transformOrigin: "bottom",
                animation: `bar-bounce 0.6s ease-in-out infinite`,
                animationDelay: `${(i * 0.07).toFixed(2)}s`,
              }}
            />
          ))}
        </div>
      )}

      <p
        className="text-2xl leading-relaxed sm:text-3xl"
        style={{ color: "var(--radio-text)" }}
      >
        {text}
      </p>
    </div>
  );
}
