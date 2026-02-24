### Speakers prompt

Let's update the flow and code to better support a conversational podcast-like transcript. With  
 whisperx, we get speaker diarization as an output, which comes out as SPEAKER_00 or SPEAKER_01,  
 etc. Let's:\\

- When whisperx is selected, allow user to input the number of speakers, which we pass in as  
  min_speakers
- Store speaker identity in the raw transcript on a per-segment level\\
- Add a "speaker_names" array in the episodes table eg ['alice', bob'] etc maps to SPEAKER_00,  
  SPEAKER_01, etc.\
- Update postprocess summary step to also have the llm generate output a likely list of  
  speaker_names, which we store into convex\
- Update all processing code and prompts so that paragraphs never combine segments from two  
  different speakers\\
- In Cleaned transcript view, show the identity of the speaker of each paragraph by prepending with  
  in bold, eg. "Alice Keys: ..."

# Peruse - Implementation Plan

## Context

Build an app that converts podcast episodes into high-quality transcripts. Users provide a podcast URL, the system downloads audio, transcribes via Replicate (nvidia/canary-qwen-2.5b), post-processes with Claude Sonnet 4.6, and displays the result with an inline player, summary, chapters, and timestamped paragraphs.

Starting from a fresh Next.js 16 + Tailwind v4 + Bun scaffold.

---

## 1. Install Dependencies

```bash
bun add convex @anthropic-ai/sdk replicate
```

---

## 2. Convex Schema & Setup

Run `bunx convex init` to scaffold Convex, then define the schema.

**`convex/schema.ts`**

```ts
episodes {
  title: string
  url: string              // original podcast URL
  audioUrl?: string        // extracted/direct audio URL
  slug: string             // URL-safe title for /ep/[slug]
  status: "pending" | "downloading" | "transcribing" | "processing" | "done" | "error"
  error?: string
  rawTranscript?: string   // JSON: array of {start, end, text} segments
  transcript?: string      // JSON: post-processed paragraphs with timestamps
  summary?: string
  chapters?: string        // JSON: array of {title, timestamp}
  createdAt: number
}
```

**Convex functions:**

- `episodes.list` — query all episodes (for homepage)
- `episodes.getBySlug` — query single episode by slug
- `episodes.create` — mutation to insert new episode
- `episodes.updateStatus` — mutation to update status/fields
- `episodes.update` — mutation to write transcript/summary/chapters

---

## 3. Directory Structure

```
app/
  layout.tsx              — update metadata, add ConvexProvider
  page.tsx                — homepage: list all episodes
  upload/
    page.tsx              — upload form
  ep/
    [slug]/
      page.tsx            — episode detail page
  api/
    process/
      route.ts            — POST: kicks off the full pipeline
lib/
  transcribe.ts           — ASR abstraction (Replicate wrapper)
  postprocess.ts          — Claude post-processing
  audio.ts                — validate audio URL
  slugify.ts              — URL slug generation
components/
  episode-card.tsx        — card for homepage list
  audio-player.tsx        — inline audio player
  transcript-view.tsx     — rendered transcript with timestamps
  status-badge.tsx        — status indicator
convex/
  schema.ts
  episodes.ts             — queries & mutations
```

---

## 4. Processing Pipeline (`app/api/process/route.ts`)

This is a Next.js API route that orchestrates the full pipeline. Called after episode creation.

1. **Validate audio URL** — confirm the URL points to a direct audio file (.mp3, .wav, etc.). Store it as `audioUrl` on the episode.
2. **Transcribe** — send audio to Replicate (`nvidia/canary-qwen-2.5b`). The `lib/transcribe.ts` module abstracts this behind an interface so swapping models means changing one file.
3. **Post-process** — send raw transcript segments to Claude Sonnet 4.6 via `lib/postprocess.ts`:
   - Clean filler words, fix incoherence
   - Group into paragraphs preserving timestamps
   - Generate summary (2-3 paragraphs)
   - Generate chapter titles with timestamps
4. **Store** — write all results back to Convex via mutations
5. **Status updates** — update Convex status at each stage so the UI reflects progress

### ASR Abstraction (`lib/transcribe.ts`)

```ts
interface TranscriptSegment {
  start: number; // seconds
  end: number;
  text: string;
}

interface ASRProvider {
  transcribe(audioUrl: string): Promise<TranscriptSegment[]>;
}
```

Default implementation uses Replicate. Swapping models = new class implementing this interface.

### Post-processing (`lib/postprocess.ts`)

Uses `@anthropic-ai/sdk` with `claude-sonnet-4-6`. Sends raw segments and asks for structured JSON output containing:

- Cleaned paragraphs with start/end timestamps
- Summary
- Chapter titles with timestamps

For long transcripts, chunk into ~15-minute segments and process each, then combine.

---

## 5. Pages

### Homepage `/` (`app/page.tsx`)

- Query `episodes.list` from Convex
- Display cards with title, status badge, date
- Link to `/ep/[slug]` for completed episodes
- Link to `/upload` button

### Upload `/upload/page.tsx`

- Simple form: text input for podcast URL
- On submit: call `episodes.create` mutation, then POST to `/api/process` with the episode ID
- Redirect to homepage or episode page with "processing" status

### Episode `/ep/[slug]/page.tsx`

- Query `episodes.getBySlug`
- If processing: show status/progress
- If done: render:
  - **Audio player** — `<audio>` element with custom controls using the audioUrl
  - **Summary** — rendered at top
  - **Chapters** — clickable outline that seeks the player
  - **Transcript** — paragraphs with timestamps; clicking timestamp seeks player

---

## 6. Components

- **`AudioPlayer`** — wraps `<audio>`, exposes ref for seeking, shows progress bar
- **`TranscriptView`** — renders paragraphs, highlights current paragraph based on playback time, clickable timestamps
- **`EpisodeCard`** — homepage card with title, status, date
- **`StatusBadge`** — colored badge showing pipeline stage

---

## 7. Environment Variables (`.env.local`)

```
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...
REPLICATE_API_TOKEN=...
ANTHROPIC_API_KEY=...
```

---

## 8. Implementation Order

1. **Convex setup** — init, schema, basic queries/mutations
2. **App shell** — layout with ConvexProvider, homepage listing episodes
3. **Upload page** — form + create mutation
4. **API route + pipeline** — `/api/process` with audio download, transcription, post-processing
5. **Episode page** — display transcript, summary, chapters, player
6. **Polish** — status updates, error handling, loading states

---

## 9. Verification

- Run `bun dev` and `bunx convex dev` side by side
- Upload a podcast URL on `/upload`
- Verify episode appears on homepage with status updates
- Once complete, navigate to `/ep/[slug]` and confirm:
  - Audio player works
  - Summary displays
  - Chapters are clickable and seek the player
  - Transcript shows with paragraph timestamps
  - Clicking timestamps seeks the player
