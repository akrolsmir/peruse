const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma"];

export async function validateAudioUrl(url: string): Promise<string> {
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();

  const hasAudioExtension = AUDIO_EXTENSIONS.some((ext) => path.endsWith(ext));
  if (hasAudioExtension) {
    return url;
  }

  // Try a HEAD request to check content type
  const res = await fetch(url, { method: "HEAD" });
  const contentType = res.headers.get("content-type") || "";
  if (contentType.startsWith("audio/")) {
    return url;
  }

  // If URL doesn't look like audio, still allow it — the user might know better
  // The transcription service will fail if it's truly not audio
  return url;
}
