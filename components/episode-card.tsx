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

  const content = (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {episode.title}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">{date}</p>
      </div>
      <div className="flex items-center gap-2">
        {hasTranscript && (episode.status === "done" || episode.status === "error") && (
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {reprocessing ? "Cloning..." : "Reprocess"}
          </button>
        )}
        <StatusBadge status={episode.status} />
      </div>
    </div>
  );

  return (
    <Link href={`/ep/${episode.slug}`} className="block">
      {content}
    </Link>
  );
}
