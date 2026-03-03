import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { generateTranscriptMarkdown } from "@/lib/transcript-markdown";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const episode = await fetchQuery(api.episodes.getBySlug, { slug });

  if (!episode) {
    return new Response("Episode not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const feed = episode.feedId
    ? await fetchQuery(api.feeds.getById, { id: episode.feedId })
    : null;

  const paragraphs = episode.transcript ? JSON.parse(episode.transcript) : [];
  const chapters = episode.chapters ? JSON.parse(episode.chapters) : [];
  const speakerNames = episode.speakerNames ?? undefined;

  if (paragraphs.length === 0) {
    return new Response("No transcript available.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const md = generateTranscriptMarkdown({
    title: episode.title,
    slug,
    date: episode.pubDate ?? episode.createdAt,
    podcastName: feed?.title,
    summary: episode.summary,
    chapters,
    paragraphs,
    speakerNames,
  });

  return new Response(md, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
