"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { clientEnv } from "@/lib/env";
import { ko } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchFirstFamilyMember } from "@/lib/supabase/family";

const RESEND_COOLDOWN_SEC = 60;

export function LoginPageClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function clearUrlHash() {
      const search =
        window.location.search && window.location.search !== "?"
          ? window.location.search
          : "";

      window.history.replaceState(
        null,
        document.title,
        `${window.location.pathname}${search}`
      );
    }

    function handleHashError() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);

      if (!hashParams.has("error")) {
        return false;
      }

      setAuthMessage(ko.family.auth.linkExpired);
      clearUrlHash();
      return true;
    }

    if (handleHashError()) {
      return;
    }

    let isMounted = true;
    const db = getSupabaseBrowserClient();

    async function redirectToFirstElder() {
      if (redirectingRef.current) return;
      redirectingRef.current = true;

      try {
        const member = await fetchFirstFamilyMember(db);
        if (!isMounted) return;

        if (member) {
          router.replace(`/family/${member.elder_id}`);
        } else {
          redirectingRef.current = false;
          setAuthMessage(ko.family.auth.noLinkedElder);
        }
      } catch (error) {
        redirectingRef.current = false;
        console.error("Failed to fetch family member after sign-in:", error);
      }
    }

    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (handleHashError()) {
        return;
      }

      if (event === "SIGNED_IN" && session) {
        redirectToFirstElder();
      }
    });

    window.addEventListener("hashchange", handleHashError);

    async function redirectExistingSession() {
      const {
        data: { session },
      } = await db.auth.getSession();

      if (session) {
        redirectToFirstElder();
      }
    }

    redirectExistingSession();

    return () => {
      isMounted = false;
      window.removeEventListener("hashchange", handleHashError);
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (cooldownSec <= 0) return;

    const timerId = window.setTimeout(() => {
      setCooldownSec((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [cooldownSec]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || cooldownSec > 0) {
      return;
    }

    setIsSubmitting(true);
    setAuthMessage(null);

    try {
      const db = getSupabaseBrowserClient();
      const { error } = await db.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/family/login`,
        },
      });

      if (!error) {
        setSent(true);
        setCooldownSec(RESEND_COOLDOWN_SEC);
      } else {
        console.error("Magic link request failed:", error);
      }
    } catch (error) {
      console.error("Magic link request failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSubmitDisabled = isSubmitting || cooldownSec > 0;

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-stone-900">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold">{ko.family.auth.loginTitle}</h1>
          <p className="mt-3 text-lg text-stone-600">{ko.family.appTagline}</p>

          {authMessage ? (
            <p className="mt-5 rounded-md bg-rose-50 px-4 py-3 text-stone-700">
              {authMessage}
            </p>
          ) : null}

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
              disabled={isSubmitDisabled}
              type="submit"
            >
              {cooldownSec > 0
                ? ko.family.auth.resendCooldown(cooldownSec)
                : ko.family.auth.loginSubmit}
            </button>
          </form>

          {sent ? (
            <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-stone-700">
              {ko.family.auth.loginSent}
              {cooldownSec > 0 ? (
                <span className="mt-1 block">
                  {ko.family.auth.resendCooldown(cooldownSec)}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
