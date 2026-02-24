import { NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser();

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const feed = await parser.parseURL(url);

    const episodes = (feed.items || []).map((item) => ({
      guid: item.guid || item.link || item.title || "",
      title: item.title || "Untitled",
      description: item.contentSnippet || item.content || "",
      audioUrl: item.enclosure?.url || "",
      pubDate: item.pubDate || "",
      duration: item.itunes?.duration || "",
    }));

    return NextResponse.json({
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
