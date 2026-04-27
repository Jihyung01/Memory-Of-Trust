"use client";

import { ko } from "@/lib/i18n";

interface MicButtonProps {
  isActive: boolean;
  onPress: () => void;
}

export function MicButton({ isActive, onPress }: MicButtonProps) {
  return (
    <button
      aria-pressed={isActive}
      className={[
        "flex min-h-28 min-w-72 items-center justify-center rounded-full border-4 px-12 py-7",
        "text-4xl font-bold leading-none tracking-normal shadow-lg transition-transform duration-200 active:scale-95",
        isActive
          ? "border-amber-700 bg-amber-200 text-stone-900"
          : "border-amber-600 bg-amber-100 text-stone-800",
      ].join(" ")}
      onClick={onPress}
      type="button"
    >
      {isActive ? ko.elder.micStop : ko.elder.micStart}
    </button>
  );
}
