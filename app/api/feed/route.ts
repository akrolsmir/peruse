import { NextResponse } from "next/server";
import Parser from "rss-parser";
import type { FeedEpisode } from "@/lib/feed";
import { fetchSubstackArchive, isSubstackFeed } from "@/lib/substack";

const parser = new Parser();
type FeedItem = Awaited<ReturnType<typeof parser.parseString>>["items"][number];

const USER_AGENT = "Mozilla/5.0 (compatible; Peruse/1.0)";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const { feedUrl, xml } = await resolveFeed(url);
    const feed = await parser.parseString(xml);

    let episodes: FeedEpisode[] = (feed.items || []).map(itemToEpisode);

    // Substack caps its RSS at 20 items; pull the full archive from its API instead.
    // The RSS items carry full show notes where the API only has a subtitle, so keep
    // those for the posts that appear in both. Falls back to RSS if the API fails.
    if (isSubstackFeed(feed.generator) && feed.link) {
      try {
        const rssDescriptions = new Map(episodes.map((ep) => [ep.guid, ep.description]));
        episodes = (await fetchSubstackArchive(feed.link)).map((ep) => {
          const rssDescription = rssDescriptions.get(ep.guid);
          return ep.kind === "audio" &&
            rssDescription &&
            rssDescription.length > ep.description.length
            ? { ...ep, description: rssDescription }
            : ep;
        });
      } catch (err) {
        console.warn("Substack archive fetch failed, using RSS items:", err);
      }
    }

    return NextResponse.json({
      feedUrl,
      title: feed.title || "Untitled Feed",
      description: feed.description || "",
      imageUrl: feed.image?.url || feed.itunes?.image || "",
      episodes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse feed" },
      { status: 500 },
    );
  }
}

function itemToEpisode(item: FeedItem): FeedEpisode {
  // Only audio/video enclosures are transcribable. Blog-style feeds (Substack
  // included) attach cover images as enclosures, which must not become audio URLs.
  const enclosureType = item.enclosure?.type || "";
  const isMedia = /^(audio|video)\//.test(enclosureType);
  const audioUrl = isMedia ? item.enclosure?.url || "" : "";
  // Substack (and other blog engines) put the subtitle in <description> and the
  // full post in <content:encoded>; prefer the latter's plain-text snippet as show
  // notes. Articles only need a short blurb, not their whole body.
  const fullText = item["content:encodedSnippet"] || item.contentSnippet || item.content || "";
  const description = audioUrl ? fullText : (item.contentSnippet || fullText).slice(0, 500);
  return {
    guid: item.guid || item.link || item.title || "",
    title: item.title || "Untitled",
    description,
    audioUrl,
    imageUrl: item.itunes?.image || "",
    pubDate: item.pubDate || "",
    duration: item.itunes?.duration || "",
    kind: audioUrl ? "audio" : "article",
    link: item.link || "",
  };
}

// Fetches the URL; if it's an HTML page rather than a feed, follows the page's
// RSS autodiscovery link (or tries /feed, which Substack and WordPress both use).
async function resolveFeed(inputUrl: string): Promise<{ feedUrl: string; xml: string }> {
  const first = await fetchText(inputUrl);
  if (!looksLikeHtml(first.text)) return { feedUrl: first.url, xml: first.text };

  const candidates = discoverFeedLinks(first.text, first.url);
  candidates.push(new URL("/feed", first.url).toString());

  for (const candidate of candidates) {
    try {
      const res = await fetchText(candidate);
      if (!looksLikeHtml(res.text)) return { feedUrl: res.url, xml: res.text };
    } catch {
      // try the next candidate
    }
  }
  throw new Error("Couldn't find an RSS feed at that URL");
}

async function fetchText(url: string): Promise<{ url: string; text: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
  return { url: res.url || url, text: await res.text() };
}

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 1000).trim().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<html");
}

function discoverFeedLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    if (!/rel=["']alternate["']/i.test(tag)) continue;
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // ignore malformed hrefs
    }
  }
  return links;
}
