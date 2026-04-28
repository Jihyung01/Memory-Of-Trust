interface PhotoFrameProps {
  photoUrl: string | null;
  caption: string | null;
}

export function PhotoFrame({ photoUrl, caption }: PhotoFrameProps) {
  return (
    <div
      className="w-full max-w-md overflow-hidden rounded-xl border-2"
      style={{
        background: "var(--radio-panel)",
        borderColor: "var(--radio-border)",
      }}
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        {photoUrl ? (
          <img
            alt={caption ?? ""}
            className="h-full w-full object-contain"
            draggable={false}
            src={photoUrl}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ background: "var(--radio-body)" }}
          >
            <span className="text-4xl opacity-25">📷</span>
            <span
              className="text-sm"
              style={{ color: "var(--radio-text-dim)" }}
            >
              사진이 곧 나타납니다
            </span>
          </div>
        )}
      </div>
      {caption && (
        <div
          className="border-t px-4 py-2 text-center text-base"
          style={{
            borderColor: "var(--radio-border)",
            color: "var(--radio-text-dim)",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
