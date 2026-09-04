import type { FeedEpisode } from "@/lib/feed";

// Substack's public RSS feed is capped at the 20 most recent posts. Its (undocumented
// but stable) archive endpoint paginates through the whole publication and also tells
// us each post's type and audio duration, neither of which the RSS feed carries.
const PAGE_SIZE = 50; // the API rejects anything larger
const MAX_PAGES = 200;

const USER_AGENT = "Mozilla/5.0 (compatible; Peruse/1.0)";

type SubstackPost = {
  id: number;
  type: string; // "newsletter" | "podcast" | "video" | "thread" | ...
  title: string | null;
  subtitle: string | null;
  description: string | null;
  canonical_url: string;
  post_date: string;
  cover_image: string | null;
  podcast_url: string | null;
  podcast_duration: number | null;
  podcast_episode_image_url: string | null;
};

export function isSubstackFeed(generator: string | undefined): boolean {
  return (generator ?? "").trim().toLowerCase() === "substack";
}

export async function fetchSubstackArchive(siteUrl: string): Promise<FeedEpisode[]> {
  const base = new URL(siteUrl).origin;
  const posts: SubstackPost[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}/api/v1/archive?sort=new&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Substack archive returned ${res.status}`);
    const batch = (await res.json()) as SubstackPost[];
    if (!Array.isArray(batch)) throw new Error("Unexpected Substack archive response");
    // Pages can come back short (the API filters some posts after paging), so only
    // an empty page means we've reached the end. Pinned posts repeat, hence the dedupe.
    if (batch.length === 0) break;
    for (const post of batch) {
      if (seen.has(post.canonical_url)) continue;
      seen.add(post.canonical_url);
      posts.push(post);
    }
  }

  return posts.map(postToEpisode);
}

function postToEpisode(post: SubstackPost): FeedEpisode {
  // Video posts whose audio was added to the podcast feed show up as type
  // "podcast" with a podcast_url, so they're transcribable like any episode.
  // Everything else (newsletters, video-only, threads) is an article we link to.
  const audioUrl = post.type === "podcast" ? post.podcast_url || "" : "";
  return {
    guid: post.canonical_url,
    title: post.title || "Untitled",
    description: post.description || post.subtitle || "",
    audioUrl,
    imageUrl: post.podcast_episode_image_url || post.cover_image || "",
    pubDate: post.post_date,
    duration: post.podcast_duration ? String(Math.round(post.podcast_duration)) : "",
    kind: audioUrl ? "audio" : "article",
    link: post.canonical_url,
  };
}
