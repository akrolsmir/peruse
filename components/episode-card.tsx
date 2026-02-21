"use client";

import Link from "next/link";
import { StatusBadge } from "./status-badge";

interface Episode {
  _id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: number;
}

export function EpisodeCard({ episode }: { episode: Episode }) {
  const date = new Date(episode.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isClickable = episode.status === "done";

  const content = (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {episode.title}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">{date}</p>
      </div>
      <StatusBadge status={episode.status} />
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/ep/${episode.slug}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
