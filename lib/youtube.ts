// Helpers for treating a YouTube link as a transcription source.
//
// Metadata (title/description/thumbnail) comes from the YouTube Data API v3,
// run from the Next.js route (`YOUTUBE_API_KEY`). Audio is resolved to a public
// mp3 URL via a third-party RapidAPI youtube-to-mp3 provider, run from the
// Convex action (`RAPIDAPI_KEY`). Both read their env at call time.

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];

export function isYoutubeUrl(url: string): boolean {
  try {
    return YT_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function extractVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // youtu.be/<id>
  if (parsed.hostname === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }

  // youtube.com/watch?v=<id>
  const v = parsed.searchParams.get("v");
  if (v) return v;

  // youtube.com/shorts/<id>, /embed/<id>, /live/<id>
  const m = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/);
  if (m) return m[1];

  return null;
}

export interface YoutubeMetadata {
  title: string;
  description: string;
  imageUrl?: string;
  pubDate?: number;
}

// YouTube Data API v3 — videos.list (part=snippet). 1 quota unit/call.
export async function fetchYoutubeMetadata(url: string): Promise<YoutubeMetadata> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not set");
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not parse a video ID from that YouTube URL");
  }

  const endpoint =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet` +
    `&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new Error(`YouTube API quota exceeded or key invalid: ${body}`);
    }
    throw new Error(`YouTube API error (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: Record<string, { url?: string }>;
      };
    }>;
  };

  const snippet = data.items?.[0]?.snippet;
  if (!snippet) {
    throw new Error("Video not found (it may be private, deleted, or region-locked)");
  }

  const thumbs = snippet.thumbnails ?? {};
  const imageUrl =
    thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url;

  return {
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    imageUrl,
    pubDate: snippet.publishedAt ? Date.parse(snippet.publishedAt) : undefined,
  };
}

interface AudioFormat {
  url?: string;
  mimeType?: string;
  bitrate?: number;
}

// Pull the best audio-only stream URL out of a provider response, tolerating
// the two common shapes: ytstream-style (`formats` / `adaptiveFormats` arrays
// with a `mimeType`) and youtube-media-downloader-style (`audios.items`).
function pickAudioUrl(data: unknown): string | null {
  const d = data as {
    formats?: AudioFormat[];
    adaptiveFormats?: AudioFormat[];
    audios?: { items?: AudioFormat[] };
    link?: string;
    url?: string;
  };

  const candidates: AudioFormat[] = [
    ...(d.adaptiveFormats ?? []),
    ...(d.formats ?? []),
    ...(d.audios?.items ?? []),
  ].filter((f) => f.url && (f.mimeType?.startsWith("audio/") ?? true));

  if (candidates.length > 0) {
    // Prefer mp4/m4a (broadest ASR compatibility), then highest bitrate.
    candidates.sort((a, b) => {
      const aMp4 = a.mimeType?.includes("mp4") ? 1 : 0;
      const bMp4 = b.mimeType?.includes("mp4") ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;
      return (b.bitrate ?? 0) - (a.bitrate ?? 0);
    });
    return candidates[0].url ?? null;
  }

  // Fallback for providers that return a single top-level link.
  return d.link ?? d.url ?? null;
}

// Resolve a YouTube URL to a direct audio stream URL via a RapidAPI provider
// that returns googlevideo/CDN links (default: ytstream-download-youtube-videos).
// The caller is expected to download these bytes and re-host them (the links
// can be short-lived / IP-bound), rather than handing the URL straight to a
// third party.
export async function resolveYoutubeAudioUrl(url: string): Promise<string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is not set");
  }
  const host = process.env.RAPIDAPI_YT_HOST || "ytstream-download-youtube-videos.p.rapidapi.com";

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not parse a video ID from that YouTube URL");
  }

  const endpoint = `https://${host}/dl?id=${encodeURIComponent(videoId)}`;
  const res = await fetch(endpoint, {
    headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": host },
  });
  if (!res.ok) {
    throw new Error(`YouTube audio provider error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const audioUrl = pickAudioUrl(data);
  if (!audioUrl) {
    throw new Error("YouTube audio provider returned no audio stream");
  }
  return audioUrl;
}
