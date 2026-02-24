"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { slugify } from "@/lib/slugify";

export function AddFeedForm() {
  const router = useRouter();
  const createFeed = useMutation(api.feeds.create);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check for existing feed with this URL
  const normalizedUrl = url.trim();
  const existingFeed = useQuery(
    api.feeds.getByFeedUrl,
    normalizedUrl ? { feedUrl: normalizedUrl } : "skip",
  );

  const canSubmit = !loading && url.trim() !== "" && !existingFeed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch feed");
      }

      const feed = await res.json();
      const slug = slugify(feed.title) + "-" + Date.now().toString(36);

      await createFeed({
        feedUrl: normalizedUrl,
        title: feed.title,
        description: feed.description || undefined,
        imageUrl: feed.imageUrl || undefined,
        slug,
        episodes: JSON.stringify(feed.episodes),
      });

      router.push(`/feeds/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="feedUrl"
          className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400"
        >
          RSS Feed URL
        </label>
        <input
          id="feedUrl"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://feeds.example.com/podcast.xml"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      {existingFeed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
          This feed has already been added.{" "}
          <a
            href={`/feeds/${existingFeed.slug}`}
            className="font-medium underline hover:no-underline"
          >
            View it here
          </a>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Fetching feed...
          </span>
        ) : (
          "Add Feed"
        )}
      </button>
    </form>
  );
}
