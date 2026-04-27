"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ko } from "@/lib/i18n";
import {
  fetchRecentRawUtterances,
  type FamilyUtteranceRecord,
} from "@/lib/supabase/family";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface FamilyDashboardClientProps {
  elderId: string;
}

function formatStartedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FamilyDashboardClient({ elderId }: FamilyDashboardClientProps) {
  const router = useRouter();
  const [utterances, setUtterances] = useState<FamilyUtteranceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const db = getSupabaseBrowserClient();

    async function fetchUtterances() {
      const {
        data: { session },
      } = await db.auth.getSession();

      if (!session) {
        router.replace("/family/login");
        return;
      }

      const rows = await fetchRecentRawUtterances(db, elderId);
      setUtterances(rows);
      setIsLoading(false);
    }

    fetchUtterances().catch(() => {
      setIsLoading(false);
    });
  }, [elderId, router]);

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-stone-900">
      <section className="mx-auto w-full max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-500">
              {ko.family.appName}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {ko.family.utterances.title}
            </h1>
          </div>
          <Link
            className="rounded-md bg-stone-900 px-4 py-3 text-center text-base font-semibold text-white"
            href={`/family/${elderId}/photos`}
          >
            {ko.family.photos.uploadButton}
          </Link>
        </header>

        <div className="mt-8 space-y-4">
          {!isLoading && utterances.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-6 text-lg text-stone-600">
              {ko.family.utterances.empty}
            </p>
          ) : null}

          {utterances.map((utterance) => (
            <article
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
              key={utterance.id}
            >
              <time className="text-sm font-medium text-stone-500">
                {formatStartedAt(utterance.started_at)}
              </time>
              <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-stone-900">
                {utterance.transcript}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
