"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense } from "react";

const DiffView = dynamic(() => import("@/components/diff-view").then((m) => m.DiffView), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2 py-24">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
      <span className="text-sm text-zinc-400">Loading...</span>
    </div>
  ),
});

export default function DiffPage() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <Link
        href="/episodes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Episodes
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Compare transcriptions
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Two episodes side by side: raw ASR output, Claude-cleaned transcript, summary, and a word
          diff. Scrolling is synced by timestamp.
        </p>
      </header>

      <Suspense>
        <DiffView />
      </Suspense>
    </div>
  );
}
