# YouTube transcription source — WIP

Status: **partially working.** Metadata + UI + pipeline wiring are done and verified.
The audio download step fails from Convex's datacenter IP (403). See "Blocker" below.

## What this adds

A third audio source ("YouTube") in the upload form, alongside URL and File. Paste a
YouTube link → auto-fill title/description/thumbnail from metadata → transcribe its audio
through the existing Replicate + Claude pipeline.

## How it works

1. **Metadata** (`lib/youtube.ts` → `fetchYoutubeMetadata`, called by `app/api/youtube/route.ts`)
   - YouTube Data API v3 `videos.list?part=snippet`. Returns full description, title, maxres
     thumbnail, publishedAt. Needs `YOUTUBE_API_KEY` (Next.js server only).
   - **Verified working.**
2. **UI** (`components/upload-form.tsx`)
   - "YouTube" toggle + URL input; on blur it POSTs `/api/youtube` and populates
     title/description/image/pubDate (kept editable). `imageUrl`/`pubDate` are now stateful.
   - **Verified working** (details fetched correctly in-app).
3. **Audio** (`lib/youtube.ts` → `resolveYoutubeAudioUrl`, used by `convex/processing.ts`)
   - RapidAPI provider `ytstream-download-youtube-videos` (`RAPIDAPI_KEY`, optional
     `RAPIDAPI_YT_HOST`) resolves the video to a direct `googlevideo.com` audio stream
     (`adaptiveFormats`, prefers itag 140 audio/mp4).
   - `processEpisode` downloads those bytes and re-hosts them in **Convex storage**, then
     hands Replicate the stable `.convex.cloud` URL (handing the raw googlevideo URL to
     Replicate wouldn't work — Replicate is also datacenter-IP).

## Blocker

The resolved `googlevideo.com` URL has the **provider's IP baked into its signed params**
(`sparams` includes `ip=<provider IP>`). Google enforces this loosely for residential IPs
but **403s datacenter IPs**. The download runs in a Convex action (datacenter) → 403
("Failed to download YouTube audio (403)").

- Verified: same URL downloads fine (HTTP 206, real audio/mp4 bytes) from a local
  residential IP. So the code path is correct; only the fetch origin IP is the problem.
- This is the well-known YouTube datacenter-IP block, surfacing at the download step.

## Provider notes

- ✅ `ytstream-download-youtube-videos` — returns real googlevideo audio streams. Works
  cross-IP from residential, 403 from datacenter.
- ❌ `youtube-mp36` (ytjar) — reports `status: ok` but its `123tokyo.xyz` download links
  hard-404 for any server-side fetch. Do not use.
- RapidAPI keys are account-wide, but each API needs its own (free) subscription.

## Tentative next steps (pick based on deploy target)

- **If running local-only / self-hosted on a residential IP:** move the audio download from
  the Convex action into a Next.js route (residential IP in dev), upload to Convex storage
  there, and pass the resulting storageId/URL into `startProcessing` like the file-upload
  path. Free, works today; would break if deployed to a cloud datacenter.
- **If deploying to Vercel / cloud:** the bytes need a non-blocked origin —
  (a) find a RapidAPI provider that hosts the file on its **own CDN** (proxied, any-IP
  fetchable) and verify bytes actually download, or
  (b) route the download through a **residential proxy** (~$3–20/mo; yt-dlp/fetch `--proxy`).
- **Lowest-ops alternative — skip audio entirely:** pivot YouTube inputs to **Supadata**
  (or similar) to fetch YouTube's own captions/AI transcript, then run the existing Claude
  post-processing. Reliable on any IP; tradeoff is caption-quality text instead of Whisper
  ASR and no diarization.

## Files

- New: `lib/youtube.ts`, `app/api/youtube/route.ts`
- Edited: `convex/processing.ts`, `components/upload-form.tsx`, `scripts/sync-env.ts`,
  `.env.example`, `CLAUDE.md`

## Env

- `YOUTUBE_API_KEY` — YouTube Data API v3 (Next.js only).
- `RAPIDAPI_KEY` — synced to Convex via `bun run sync-env`.
- `RAPIDAPI_YT_HOST` — optional, defaults to `ytstream-download-youtube-videos.p.rapidapi.com`.
