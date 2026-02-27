"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EpisodeCard } from "@/components/episode-card";

interface FeedEpisode {
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  pubDate: string;
  duration: string;
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  // Already in h:mm:ss or mm:ss format
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.length === 3) {
      const [h, m] = parts;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    const [m, s] = parts;
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  // Raw seconds
  const totalSec = parseInt(raw, 10);
  if (isNaN(totalSec)) return raw;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FeedDetail({ slug }: { slug: string }) {
  const feed = useQuery(api.feeds.getBySlug, { slug });
  const transcribedEpisodes = useQuery(
    api.episodes.listByFeed,
    feed?._id ? { feedId: feed._id } : "skip",
  );
  const updateEpisodes = useMutation(api.feeds.updateEpisodes);
  const [refreshing, setRefreshing] = useState(false);

  if (feed === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  if (feed === null) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Feed not found</p>
      </div>
    );
  }

  const episodes: FeedEpisode[] = JSON.parse(feed.episodes);
  const daysSinceRefresh = (Date.now() - feed.lastFetchedAt) / (1000 * 60 * 60 * 24);
  const isStale = daysSinceRefresh > 7;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feed.feedUrl }),
      });
      if (!res.ok) throw new Error("Failed to refresh feed");
      const data = await res.json();
      await updateEpisodes({
        id: feed._id as Id<"feeds">,
        episodes: JSON.stringify(data.episodes),
      });
    } catch {
      // Silently fail — user can try again
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      {/* Feed header */}
      <div className="mb-8 flex items-start gap-4">
        {feed.imageUrl && (
          <img src={feed.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {feed.title}
          </h1>
          {feed.description && (
            <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{feed.description}</p>
          )}
        </div>
      </div>

      {/* Transcribed episodes */}
      {transcribedEpisodes && transcribedEpisodes.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Transcribed
          </h2>
          <div className="space-y-2">
            {transcribedEpisodes.map((ep) => (
              <EpisodeCard key={ep._id} episode={ep} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          {episodes.length} episode{episodes.length !== 1 ? "s" : ""}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:opacity-50 ${
            isStale
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Episode list */}
      {(() => {
        const transcribedTitles = new Set(
          (transcribedEpisodes ?? []).map((ep) => ep.title),
        );

        return (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {episodes.map((ep) => {
              const pubDate = ep.pubDate
                ? new Date(ep.pubDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : null;

              const isTranscribed = transcribedTitles.has(ep.title);

              const transcribeParams = new URLSearchParams();
              if (ep.title) transcribeParams.set("title", ep.title);
              if (ep.audioUrl) transcribeParams.set("url", ep.audioUrl);
              if (ep.description) transcribeParams.set("description", ep.description);
              transcribeParams.set("feedId", feed._id);

              return (
                <div
                  key={ep.guid}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40"
                >
                  <h3 className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                    {ep.title}
                  </h3>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-300 dark:text-zinc-600">
                    {ep.duration ? formatDuration(ep.duration) : ""}
                  </span>
                  {pubDate && (
                    <time className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-300 dark:text-zinc-600">
                      {pubDate}
                    </time>
                  )}
                  {ep.audioUrl && (
                    <Link
                      href={`/upload?${transcribeParams.toString()}`}
                      className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                        isTranscribed
                          ? "border border-amber-400/60 text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          : "bg-amber-500 text-white hover:bg-amber-400"
                      }`}
                    >
                      Transcribe
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
