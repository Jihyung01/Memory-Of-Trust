interface PhotoFrameProps {
  photoUrl: string | null;
}

export function PhotoFrame({ photoUrl }: PhotoFrameProps) {
  return (
    <div
      className="w-full max-w-md overflow-hidden rounded-xl border-2 p-2"
      style={{
        background: "#fffdf8",
        borderColor: "var(--radio-border)",
        boxShadow: "0 18px 36px rgba(65, 50, 32, 0.12)",
      }}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg">
        {photoUrl ? (
          <img
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
            src={photoUrl}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ background: "#efe5d3" }}
          >
            <span className="text-4xl opacity-50">사진</span>
          </div>
        )}
      </div>
    </div>
  );
}
