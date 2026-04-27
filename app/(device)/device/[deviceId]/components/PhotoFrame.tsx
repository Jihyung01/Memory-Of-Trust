interface PhotoFrameProps {
  photoUrl: string | null;
  caption: string | null;
}

export function PhotoFrame({ photoUrl, caption }: PhotoFrameProps) {
  return (
    <div className="flex w-full max-w-5xl items-center justify-center rounded-lg border border-amber-200 bg-stone-100 p-3 shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-amber-100">
        {photoUrl ? (
          // Signed Supabase URLs are rendered as plain images to avoid widening Next image config in T4.
          <img
            alt={caption ?? ""}
            className="h-full w-full object-contain"
            draggable={false}
            src={photoUrl}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_center,#fef3c7,#e7e5e4)]" />
        )}
      </div>
    </div>
  );
}
