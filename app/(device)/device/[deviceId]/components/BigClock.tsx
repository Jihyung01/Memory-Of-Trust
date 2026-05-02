"use client";

import { useEffect, useState } from "react";

function formatClock(date: Date | null) {
  if (!date) {
    return { time: "--:--", date: "" };
  }
  return {
    time: date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    date: date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
  };
}

export function BigClock() {
  const [now, setNow] = useState<Date | null>(null);
  const clock = formatClock(now);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="rounded-xl border-2 px-8 py-4 text-center"
      style={{
        background: "var(--radio-panel)",
        borderColor: "var(--radio-border)",
        boxShadow: "0 8px 22px rgba(63, 48, 30, 0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
      }}
    >
      <time
        className="block text-6xl font-medium leading-none tracking-widest sm:text-7xl"
        dateTime={now?.toISOString()}
        style={{
          color: "var(--radio-accent)",
          textShadow: "0 2px 10px var(--radio-accent-glow)",
        }}
      >
        {clock.time}
      </time>
      <p
        className="mt-2 text-xl leading-tight"
        style={{ color: "var(--radio-text-dim)" }}
      >
        {clock.date}
      </p>
    </div>
  );
}
