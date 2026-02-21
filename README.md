# Notes

Example URL: https://api.substack.com/feed/podcast/187852154/cecdbe38125e2786cbfebe31dd083d4f.mp3 (dwarkesh podcast)

## How it works

When you submit a URL on `/upload`:

1. **Create episode** — a Convex mutation inserts a new episode record with status `pending` and a URL-safe slug
2. **POST `/api/process`** — the client fires off the processing pipeline and redirects home. The pipeline runs async in the API route:
   - **Validate** (`lib/audio.ts`) — checks the URL has an audio extension or `audio/*` content-type via HEAD request. Sets status to `downloading`.
   - **Transcribe** (`lib/transcribe.ts`) — sends the audio URL to Replicate's `nvidia/canary-qwen-2.5b` model, which returns timestamped text segments like `[0:00:00 - 0:00:40] Text...`. The parser splits these into `{start, end, text}` objects. Sets status to `transcribing`.
   - **Post-process** (`lib/postprocess.ts`) — sends raw segments to Claude Sonnet 4.6 in ~15-minute chunks. Claude cleans filler words, fixes recognition errors, and groups sentences into paragraphs with timestamps. A second call generates a summary and chapter list. Sets status to `processing`.
   - **Store** — writes the transcript, summary, and chapters back to Convex as JSON strings. Sets status to `done`.
3. **Live updates** — the homepage and episode page use Convex's `useQuery`, which subscribes to real-time changes. Status badges update automatically as the pipeline progresses.
4. **Playback** — on `/ep/[slug]`, the audio player, chapters, and transcript are wired together. Clicking a timestamp or chapter seeks the `<audio>` element via a forwarded ref. The transcript highlights the current paragraph based on playback time.
