"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const EpisodeList = dynamic(
  () => import("@/components/episode-list").then((m) => m.EpisodeList),
  { ssr: false, loading: () => <div className="py-12 text-center text-sm text-zinc-500">Loading...</div> }
);

export default function Home() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            PTT
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Podcast to Text</p>
        </div>
        <Link
          href="/upload"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          New Episode
        </Link>
      </div>
      <EpisodeList />
    </div>
  );
}
