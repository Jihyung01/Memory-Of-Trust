interface PromptBubbleProps {
  text: string;
}

export function PromptBubble({ text }: PromptBubbleProps) {
  return (
    <p className="max-w-5xl rounded-lg border border-amber-200 bg-stone-100 px-8 py-5 text-center text-4xl font-semibold leading-snug tracking-normal text-stone-800 shadow-sm">
      {text}
    </p>
  );
}
