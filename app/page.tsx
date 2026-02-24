"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const FeedList = dynamic<{ recent?: boolean }>(
  () => import("@/components/feed-list").then((m) => m.FeedList),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-12">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    ),
  },
);

const EpisodeList = dynamic<{ recent?: boolean }>(
  () => import("@/components/episode-list").then((m) => m.EpisodeList),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-12">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    ),
  },
);

export default function Home() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <header className="mb-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              peruse
            </h1>
            <p className="mt-1 text-sm text-zinc-400">podcast transcripts worth reading</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/new-feed"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-95 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              New Feed
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-amber-400 active:scale-95"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              New Episode
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Feeds</h2>
          <Link
            href="/feeds"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            See all &rarr;
          </Link>
        </div>
        <FeedList recent />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Episodes
          </h2>
          <Link
            href="/episodes"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            See all &rarr;
          </Link>
        </div>
        <EpisodeList recent />
      </section>
    </div>
  );
}
