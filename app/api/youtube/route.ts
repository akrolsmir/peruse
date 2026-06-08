import { NextResponse } from "next/server";
import { fetchYoutubeMetadata, isYoutubeUrl } from "@/lib/youtube";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string" || !isYoutubeUrl(url)) {
      return NextResponse.json({ error: "A valid YouTube URL is required" }, { status: 400 });
    }

    const metadata = await fetchYoutubeMetadata(url);
    return NextResponse.json(metadata);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch YouTube metadata" },
      { status: 400 },
    );
  }
}
