"use client";

import { useEffect, useState } from "react";

function formatClock(date: Date | null) {
  if (!date) {
    return {
      time: "--:--",
      date: "",
    };
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
    <div className="w-full max-w-80 rounded-lg border border-amber-200 bg-stone-100 px-6 py-5 shadow-sm">
      <time
        className="block text-center text-6xl font-semibold leading-none tracking-normal text-stone-800 sm:text-7xl lg:text-8xl"
        dateTime={now?.toISOString()}
      >
        {clock.time}
      </time>
      <p className="mt-4 text-center text-3xl font-medium leading-tight text-stone-600">
        {clock.date}
      </p>
    </div>
  );
}
