"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusBadge } from "./status-badge";
import { useState } from "react";

interface Episode {
  _id: string;
  title: string;
  slug: string;
  status: string;
  rawTranscript?: string;
  createdAt: number;
}

export function EpisodeCard({ episode }: { episode: Episode }) {
  const cloneEpisode = useMutation(api.episodes.clone);
  const [reprocessing, setReprocessing] = useState(false);

  const date = new Date(episode.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const hasTranscript = !!episode.rawTranscript;

  const handleReprocess = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReprocessing(true);
    try {
      const { id } = await cloneEpisode({ id: episode._id as never });
      await fetch("/api/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: id }),
      });
    } catch (err) {
      console.error("Reprocess failed:", err);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <Link href={`/ep/${episode.slug}`} className="group block">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-5 py-4 transition-all hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium text-zinc-900 transition-colors group-hover:text-amber-700 dark:text-zinc-100 dark:group-hover:text-amber-400">
            {episode.title}
          </h3>
          <time className="mt-1 block text-xs text-zinc-400">{date}</time>
        </div>
        <div className="flex items-center gap-3">
          {hasTranscript && (episode.status === "done" || episode.status === "error") && (
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
            >
              {reprocessing ? "Cloning..." : "Reprocess"}
            </button>
          )}
          <StatusBadge status={episode.status} />
        </div>
      </div>
    </Link>
  );
}
