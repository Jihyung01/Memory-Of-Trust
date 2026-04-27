"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { clientEnv } from "@/lib/env";
import { ko } from "@/lib/i18n";
import { fetchFirstFamilyMember } from "@/lib/supabase/family";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginPageClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const db = getSupabaseBrowserClient();

    async function redirectIfSignedIn() {
      const {
        data: { session },
      } = await db.auth.getSession();

      if (!session) {
        return;
      }

      const member = await fetchFirstFamilyMember(db);

      if (member) {
        router.replace(`/family/${member.elder_id}`);
      }
    }

    redirectIfSignedIn();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const db = getSupabaseBrowserClient();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/family/login`,
      },
    });

    setIsSubmitting(false);

    if (!error) {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-stone-900">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold">{ko.family.auth.loginTitle}</h1>
          <p className="mt-3 text-lg text-stone-600">{ko.family.appTagline}</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                {ko.family.auth.loginEmailLabel}
              </span>
              <input
                className="mt-2 w-full rounded-md border border-stone-300 px-4 py-3 text-lg outline-none focus:border-stone-500"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <button
              className="w-full rounded-md bg-stone-900 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {ko.family.auth.loginSubmit}
            </button>
          </form>

          {sent ? (
            <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-stone-700">
              {ko.family.auth.loginSent}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
