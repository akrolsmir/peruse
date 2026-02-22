"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EpisodeCard } from "@/components/episode-card";

export function EpisodeList() {
  const episodes = useQuery(api.episodes.list);

  if (episodes === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-amber-500"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No episodes yet</p>
        <Link
          href="/upload"
          className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400"
        >
          Upload your first podcast
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((ep) => (
        <EpisodeCard key={ep._id} episode={ep} />
      ))}
    </div>
  );
}
