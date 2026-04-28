"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ko } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface PhotosPageClientProps {
  elderId: string;
}

export function PhotosPageClient({ elderId }: PhotosPageClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestPhoto, setLatestPhoto] = useState<{
    url: string;
    caption: string | null;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (latestPhoto) {
        URL.revokeObjectURL(latestPhoto.url);
      }
    };
  }, [latestPhoto]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const db = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await db.auth.getSession();

      if (!session) {
        router.replace("/family/login");
        return;
      }

      const formData = new FormData(form);
      const photo = formData.get("photo");
      formData.set("elder_id", elderId);

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (response.ok) {
        if (latestPhoto) {
          URL.revokeObjectURL(latestPhoto.url);
        }

        const caption = formData.get("caption");
        if (photo instanceof File) {
          setLatestPhoto({
            url: URL.createObjectURL(photo),
            caption:
              typeof caption === "string" && caption.trim().length > 0
                ? caption.trim()
                : null,
          });
        }

        form.reset();
        setMessage(ko.family.photos.successToast);
      } else {
        setMessage(ko.family.photos.uploadFailed);
      }
    } catch (error) {
      console.error("Photo upload failed:", error);
      setMessage(ko.family.photos.uploadFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-stone-900">
      <section className="mx-auto w-full max-w-2xl">
        <header className="border-b border-stone-200 pb-6">
          <Link className="text-base font-semibold text-stone-600" href={`/family/${elderId}`}>
            {ko.family.nav.home}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">{ko.family.photos.title}</h1>
          <p className="mt-3 text-lg leading-8 text-stone-600">
            {ko.family.photos.subtitle}
          </p>
        </header>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {ko.family.photos.fileLabel}
            </span>
            <input
              accept="image/*"
              className="mt-2 w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-base"
              name="photo"
              required
              type="file"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {ko.family.photos.captionLabel}
            </span>
            <input
              className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-500"
              name="caption"
              type="text"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {ko.family.photos.yearLabel}
            </span>
            <input
              className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-500"
              name="approximate_year"
              type="number"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {ko.family.photos.peopleLabel}
            </span>
            <input
              className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-500"
              name="people_in_photo"
              type="text"
            />
          </label>

          <button
            className="w-full rounded-md bg-stone-900 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {ko.family.photos.uploadButton}
          </button>
        </form>

        {message ? (
          <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-stone-700">
            {message}
          </p>
        ) : null}

        {latestPhoto ? (
          <section className="mt-8 border-t border-stone-200 pt-6">
            <h2 className="text-xl font-semibold">{ko.family.photos.latestTitle}</h2>
            <figure className="mt-4 overflow-hidden rounded-md border border-stone-200 bg-white">
              <img
                alt={latestPhoto.caption ?? ko.family.photos.latestImageAlt}
                className="max-h-[420px] w-full object-contain"
                src={latestPhoto.url}
              />
              {latestPhoto.caption ? (
                <figcaption className="px-4 py-3 text-stone-700">
                  {latestPhoto.caption}
                </figcaption>
              ) : null}
            </figure>
          </section>
        ) : null}
      </section>
    </main>
  );
}
