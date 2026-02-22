# Notes

Example URL: https://api.substack.com/feed/podcast/187852154/cecdbe38125e2786cbfebe31dd083d4f.mp3 (dwarkesh podcast w/ dario, 2h)
Example URL: https://episodes.captivate.fm/episode/e45099d6-5d22-49e4-b8fd-def4040a4c04.mp3 (social radars w/ tom blomfield)
(todo: load a short, med, long snippet into default example)

choosing an ASR model off of replicate:

- vaibhavs10/incredibly-fast-whisper has a very fast cold start, but maybe slower RTF (real-time factor).
- nvidia/canary-qwen-2.5b on replicate has a limit of 120 minutes: https://github.com/zsxkib/cog-nvidia-canary-qwen-2.5b/blob/09ea034bdc4d930940b8d3ca0f4d499c181809af/predict.py#L86. also a very long replicate startup, like a minute or so
- victor-upmeet/whisperx for built in diarisation. approx 4min/1cent

- todo: for postprocessing, compare json structured output to previous (non-json) -- the timestamps seem off more often now.
- todo: maybe switch to medium effort for faster responses?

- todo: change postprocessing to create something more 80k-style. Dialog not timestamp-first; conversational but still easy to read.
  - could add clarifications eg "SWE (Software Engineer)" in parenthesis, augment eg "Holden [Karnofsky]" in brackets.
  - Could link to jargon

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
