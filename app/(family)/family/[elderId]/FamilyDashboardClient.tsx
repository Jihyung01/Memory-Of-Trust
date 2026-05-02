"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ko } from "@/lib/i18n";
import {
  fetchRecentRawUtterances,
  fetchWeeklyCards,
  fetchMonthlyChapters,
  type FamilyUtteranceRecord,
  type StoryOutputRecord,
} from "@/lib/supabase/family";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface FamilyDashboardClientProps {
  devBypass?: boolean;
  elderId: string;
  initialMonthlyChapters?: StoryOutputRecord[];
  initialUtterances?: FamilyUtteranceRecord[];
  initialWeeklyCards?: StoryOutputRecord[];
}

type TabKey = "home" | "cards" | "chapters" | "photos" | "questions";

function formatStartedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

/* ─── SVG 아이콘 ─── */
function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconQuestion() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6a6a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function FamilyDashboardClient({
  devBypass = false,
  elderId,
  initialMonthlyChapters = [],
  initialUtterances = [],
  initialWeeklyCards = [],
}: FamilyDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [utterances, setUtterances] =
    useState<FamilyUtteranceRecord[]>(initialUtterances);
  const [weeklyCards, setWeeklyCards] =
    useState<StoryOutputRecord[]>(initialWeeklyCards);
  const [monthlyChapters, setMonthlyChapters] =
    useState<StoryOutputRecord[]>(initialMonthlyChapters);
  const [isLoading, setIsLoading] = useState(!devBypass);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  useEffect(() => {
    const db = getSupabaseBrowserClient();

    async function loadData() {
      if (devBypass) {
        setIsLoading(false);
        return;
      }

      const {
        data: { session },
      } = await db.auth.getSession();

      if (!session) {
        router.replace("/family/login");
        return;
      }

      const [rows, cards, chapters] = await Promise.all([
        fetchRecentRawUtterances(db, elderId),
        fetchWeeklyCards(db, elderId).catch(() => []),
        fetchMonthlyChapters(db, elderId).catch(() => []),
      ]);

      setUtterances(rows);
      setWeeklyCards(cards);
      setMonthlyChapters(chapters);
      setIsLoading(false);
    }

    loadData().catch(() => {
      setIsLoading(false);
    });
  }, [devBypass, elderId, router]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "home", label: ko.family.nav.home, icon: <IconHome /> },
    { key: "cards", label: ko.family.nav.cards, icon: <IconCard /> },
    { key: "chapters", label: ko.family.nav.chapters, icon: <IconBook /> },
    { key: "photos", label: ko.family.nav.photos, icon: <IconCamera /> },
    { key: "questions", label: ko.family.nav.questions, icon: <IconQuestion /> },
  ];

  // 통계
  const totalUtterances = utterances.length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekCount = utterances.filter((u) => new Date(u.started_at) >= weekAgo).length;
  const lastActivity = utterances.length > 0 ? formatStartedAt(utterances[0].started_at) : "-";

  return (
    <main className="min-h-screen" style={{ background: "#f5f3ef" }}>
      {/* ─── 상단 네비 ─── */}
      <header
        className="sticky top-0 z-10 border-b px-6 py-4"
        style={{ background: "#2a2a2d", borderColor: "#3a3a3d" }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #ffb43c, #ff9800)" }}
            >
              <span className="text-sm font-bold" style={{ color: "#2a2a2d" }}>M</span>
            </div>
            <span className="text-base font-semibold text-white">{ko.family.appName}</span>
          </div>
          <button
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ color: "#8a8880", background: "rgba(255,255,255,0.08)" }}
            onClick={async () => {
              const db = getSupabaseBrowserClient();
              await db.auth.signOut();
              router.replace("/family/login");
            }}
          >
            {ko.family.auth.logout}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        {/* ─── 통계 패널 ─── */}
        <div
          className="mb-6 grid grid-cols-3 gap-4 rounded-2xl p-5"
          style={{ background: "#2a2a2d" }}
        >
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: "#ffb43c" }}>
              {totalUtterances}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#8a8880" }}>
              총 발화
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: "#ffb43c" }}>
              {thisWeekCount}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#8a8880" }}>
              이번 주
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#ffb43c" }}>
              {lastActivity}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#8a8880" }}>
              마지막 활동
            </p>
          </div>
        </div>

        {/* ─── 탭 네비게이션 ─── */}
        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl p-1" style={{ background: "#e8e4de" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.key ? "#fff" : "transparent",
                color: activeTab === tab.key ? "#2a2a2d" : "#6a6a6e",
                boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ─── 탭 내용 ─── */}
        {activeTab === "home" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "#2a2a2d" }}>
              {ko.family.utterances.title}
            </h2>
            {!isLoading && utterances.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{ background: "#fff", borderColor: "#e0dbd2", color: "#6a6a6e" }}
              >
                {ko.family.utterances.empty}
              </div>
            ) : null}
            {utterances.map((utterance) => (
              <article
                key={utterance.id}
                className="rounded-2xl border p-5"
                style={{ background: "#fff", borderColor: "#e0dbd2" }}
              >
                <time className="text-sm font-medium" style={{ color: "#8a8880" }}>
                  {formatStartedAt(utterance.started_at)}
                </time>
                <p
                  className="mt-3 whitespace-pre-wrap text-base leading-7"
                  style={{ color: "#2a2a2d" }}
                >
                  {utterance.transcript}
                </p>
              </article>
            ))}
          </section>
        )}

        {activeTab === "cards" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "#2a2a2d" }}>
              {ko.family.cards.title}
            </h2>
            {weeklyCards.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{ background: "#fff", borderColor: "#e0dbd2", color: "#6a6a6e" }}
              >
                {ko.family.cards.empty}
              </div>
            ) : null}
            {weeklyCards.map((card) => (
              <article
                key={card.id}
                className="rounded-2xl border"
                style={{ background: "#fff", borderColor: "#e0dbd2" }}
              >
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-semibold" style={{ color: "#2a2a2d" }}>
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "#8a8880" }}>
                      {formatDate(card.created_at)}
                    </p>
                  </div>
                  <button
                    className="rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{ color: "#ffb43c", background: "rgba(255,180,60,0.1)" }}
                    onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                  >
                    {expandedCard === card.id ? "접기" : ko.family.cards.readMore}
                  </button>
                </div>
                {expandedCard === card.id && (
                  <div
                    className="whitespace-pre-wrap border-t px-5 py-4 text-base leading-7"
                    style={{ borderColor: "#e0dbd2", color: "#2a2a2d" }}
                  >
                    {card.content}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {activeTab === "chapters" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "#2a2a2d" }}>
              {ko.family.chapters.title}
            </h2>
            {monthlyChapters.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{ background: "#fff", borderColor: "#e0dbd2", color: "#6a6a6e" }}
              >
                {ko.family.chapters.empty}
              </div>
            ) : null}
            {monthlyChapters.map((chapter) => (
              <article
                key={chapter.id}
                className="rounded-2xl border"
                style={{ background: "#fff", borderColor: "#e0dbd2" }}
              >
                <div className="flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-semibold" style={{ color: "#2a2a2d" }}>
                      {chapter.title}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: "#8a8880" }}>
                      {formatDate(chapter.created_at)}
                    </p>
                  </div>
                  <button
                    className="rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{ color: "#ffb43c", background: "rgba(255,180,60,0.1)" }}
                    onClick={() => setExpandedCard(expandedCard === chapter.id ? null : chapter.id)}
                  >
                    {expandedCard === chapter.id ? "접기" : "전체 보기"}
                  </button>
                </div>
                {expandedCard === chapter.id && (
                  <div
                    className="whitespace-pre-wrap border-t px-5 py-4 text-base leading-7"
                    style={{ borderColor: "#e0dbd2", color: "#2a2a2d" }}
                  >
                    {chapter.content}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {activeTab === "photos" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: "#2a2a2d" }}>
                {ko.family.photos.title}
              </h2>
              <Link
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: "#2a2a2d" }}
                href={`/family/${elderId}/photos`}
              >
                {ko.family.photos.uploadButton}
              </Link>
            </div>
            <p className="text-sm" style={{ color: "#6a6a6e" }}>
              {ko.family.photos.subtitle}
            </p>
          </section>
        )}

        {activeTab === "questions" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: "#2a2a2d" }}>
              {ko.family.questions.title}
            </h2>
            <p className="text-sm" style={{ color: "#6a6a6e" }}>
              {ko.family.questions.subtitle}
            </p>
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#fff", borderColor: "#e0dbd2" }}
            >
              <p className="text-sm italic" style={{ color: "#8a8880" }}>
                질문 기능은 곧 추가됩니다.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
