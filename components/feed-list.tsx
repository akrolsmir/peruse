"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FeedCard } from "@/components/feed-card";

export function FeedList({ recent }: { recent?: boolean }) {
  const feeds = useQuery(recent ? api.feeds.listRecent : api.feeds.list);

  if (feeds === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  if (feeds.length === 0) {
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
            <path d="M4 11a9 9 0 0 1 9 9" />
            <path d="M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No feeds yet</p>
        <Link
          href="/new-feed"
          className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400"
        >
          Add your first podcast feed
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feeds.map((feed) => (
        <FeedCard key={feed._id} feed={feed} />
      ))}
    </div>
  );
}
