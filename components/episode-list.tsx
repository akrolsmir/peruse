"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EpisodeCard } from "@/components/episode-card";

export function EpisodeList() {
  const episodes = useQuery(api.episodes.list);

  if (episodes === undefined) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">Loading...</div>
    );
  }

  if (episodes.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-zinc-500">No episodes yet.</p>
        <Link
          href="/upload"
          className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Upload your first podcast
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {episodes.map((ep) => (
        <EpisodeCard
          key={ep._id}
          episode={
            ep as unknown as {
              _id: string;
              title: string;
              slug: string;
              status: string;
              rawTranscript?: string;
              createdAt: number;
            }
          }
        />
      ))}
    </div>
  );
}
