import type { Id } from "@/convex/_generated/dataModel";

export type FeedEpisode = {
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  imageUrl?: string;
  pubDate: string;
  duration: string;
  // "audio" items can be transcribed; "article" items only link out to the original post.
  kind: "audio" | "article";
  link?: string;
};

export type ParsedFeed = {
  // The resolved feed URL, which may differ from what the user typed (e.g. a site URL).
  feedUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  episodes: FeedEpisode[];
};

// Items per Convex mutation. Keeps each call well under Convex's per-transaction
// limits (16 MiB args/writes, 1s of user code) even for feeds with long show notes.
export const FEED_BATCH_SIZE = 200;

export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const res = await fetch("/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch feed");
  }
  return res.json();
}

export type UpsertItems = (args: {
  id: Id<"feeds">;
  episodes: FeedEpisode[];
}) => Promise<{ inserted: number }>;

// Writes episodes to Convex sequentially in batches. Sequential (not parallel)
// because every batch patches the same feed document and would otherwise conflict.
export async function syncFeedItems(
  upsertItems: UpsertItems,
  feedId: Id<"feeds">,
  episodes: FeedEpisode[],
  onProgress?: (saved: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < episodes.length; i += FEED_BATCH_SIZE) {
    const batch = episodes.slice(i, i + FEED_BATCH_SIZE);
    await upsertItems({ id: feedId, episodes: batch });
    onProgress?.(Math.min(i + batch.length, episodes.length), episodes.length);
  }
}
