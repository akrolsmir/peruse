# Prompts

## Creating the app

Plan a new app, codenamed "PTT" for podcast to text. Its primary function is to turn a provided podcast episode into a high quality transcript.

Tech stack:\

NextJS, Tailwind, Bun for frontend (already provided)\
Convex for storing data, transcripts\
Replicate serving nvidia/canary-qwen-2.5b for the ASR model (but set things up so we can easily swap to others)\
Anthropic Claude Sonnet 4.6 for postprocessing (to remove filler words, fix incoherent things, and others to come later)\
All JS backend via NextJS

The core UI should start with a homepage of all uploaded podcasts; a page "/upload" which allows someone to input a podcast URL; and a page "/ep/<episode-title>" which shows the postprocessed transcript, complete with an inline player, summary, outline/chapter titles, and paragraph-level timestamps.

### Supporting speakers

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

## RSS prompt

New feature: RSS feeds.\

- Allow users to paste in a podcast rss feed url, on a new page /new-rss
- Store rss feed data into a new convex table\
- Create /rss, which displays all rss feeds\
- Under /rss/<slug>, create a nice display to view all current episodes\
  - Add a button which, on click, takes the user /upload with the episode url and metadata filled in\
- Relatedly, add a new optional field "description" on the episodes table, and an optional backlink to a particular rss feed\  
  \  
  ask me any questions you need to cleanly structure this from a codebase and data perspective

## v0 launch prio

Look over the codebase and suggest a list of priorities for issues to tackle and features to add, before we make an initial announcement and v0 release. Categorize as p0/p1/p2, and also sm/md/lg in terms of difficulty. Go broad rather than deep with the plan, don't worry about planning implementations step by step. Approach this both as a PM and as a SWE would. Aim for 10-20 suggestions.

Goals for v0 are to have something that's loved by at least some people (classic YC); might have some inherent virality and excitement; doesn't cost a bunch if eg hugged by reddit.

Consider my notes in README.md, but also come up with your own ideas. Thanks!

# Peruse - Original Implementation Plan

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

---

# Peruse v0 Launch Priorities

## Context

Peruse is a podcast-to-transcript app with a solid MVP: real-time processing pipeline, clean reading experience, chapter nav, audio player with synced highlighting. The core product loop works. What's missing are the things that make it **safe to launch publicly**, **shareable/viral**, and **delightful enough that people come back**.

Goals: loved by some people, inherent virality, doesn't bankrupt you if it hits the front page.

---

## P0 — Must ship before announcing

### 1. Rate limiting & cost protection — `md`

**Why:** A single curl loop could run up thousands in Replicate/Claude bills. This is the #1 financial risk.

- IP-based rate limit on `/api/process` (e.g. 3 episodes/hour per IP)
- Global concurrency cap (e.g. max 10 simultaneous transcriptions)
- Consider a simple queue with Convex instead of fire-and-forget
- Log cost per episode (token counts already tracked, just store them)

### 2. OG metadata for episode pages — `sm`

**Why:** When someone shares a Peruse transcript link on Twitter/Discord/Slack, it currently shows nothing. This is the #1 virality blocker. A beautiful preview card turns every share into an ad.

- `generateMetadata()` on `/ep/[slug]` with title, summary, OG image
- Consider auto-generating an OG image (episode title + podcast name on a branded card)
- Same for `/feeds/[slug]`

### 3. Fix the episode date (use pub date, not upload date) — `sm`

**Why:** Already in your TODOs. Wrong dates look broken/untrustworthy. Quick win.

### 4. Variable playback speed — `sm`

**Why:** Podcast listeners expect this. Missing it feels immediately wrong. Just a `playbackRate` control (1x, 1.25x, 1.5x, 2x).

### 5. Landing page / hero — `md`

**Why:** Right now `/` is a list of episodes. New visitors need to understand what Peruse is in 3 seconds and see an example of a beautiful transcript. Show, don't tell.

- Hero section: tagline + "Paste a podcast URL" input right on the homepage
- Featured example transcript (pre-process a great episode from a popular podcast)
- Move the episode/feed lists below the fold or to separate pages

---

## P1 — Ship soon after launch, or before if time allows

### 6. Parallel chunk processing — `md`

**Why:** A 2-hour episode currently makes ~120 sequential Claude calls taking 30-40 min. Parallelize chunks (batches of 10-20) to cut this to 3-5 min. Directly improves the "wow" moment.

### 7. Export to Markdown / copy transcript — `sm`

**Why:** Already in TODOs. High-value, low-effort. People will want to paste transcripts into notes, blogs, newsletters. A "Copy" or "Download .md" button makes the output immediately useful and shareable.

### 8. Share link with timestamp — `sm`

**Why:** `/ep/slug?t=1234` that auto-scrolls to that paragraph and starts playback. Enables sharing specific moments — the viral unit for podcasts. Like YouTube timestamps but for text.

### 9. Search within transcript — `sm`

**Why:** Ctrl+F works but a proper in-page search with highlighting and jump-to-match is much better UX, especially on mobile. Makes the transcript genuinely useful as a reference.

### 10. Sticky audio player — `sm`

**Why:** Currently the player is at the top. When reading a long transcript, you lose access to play/pause. Make it sticky at the bottom (like Spotify/Overcast). Already noted in your TODOs as a styling issue.

### 11. Mobile polish — `md`

**Why:** Shared links will be opened on phones. The transcript reading experience needs to work well on mobile: sticky player at bottom, chapter nav as a dropdown/drawer instead of sidebar, proper touch targets. Current layout is desktop-first.

### 12. Error recovery & retry — `sm`

**Why:** Replicate cold starts and transient failures will happen. A simple retry (1-2 attempts with backoff) on ASR + Claude calls prevents episodes from getting stuck in "error" or "transcribing" forever. Also add a "Retry" button on errored episodes.

---

## P2 — Nice to have, do when it feels right

### 13. "Transcribe this podcast" browser extension or bookmarklet — `md`

**Why:** Virality mechanic. One-click from any podcast page to Peruse. Much lower friction than copy-pasting URLs.

### 14. Pre-populated popular podcasts — `lg`

**Why:** New users can browse great transcripts immediately without having to submit their own. Stock the library with 10-20 episodes from popular shows (Lex Fridman, Dwarkesh, etc.). Makes the app feel alive and demonstrates quality. Could seed with RSS feeds.

### 15. Full-text search across all episodes — `md`

**Why:** "Search every podcast transcript" is a compelling pitch. Even a basic Convex text search over transcripts would be differentiated. This is the long-term moat feature.

### 16. Inline speaker name editing — `sm`

**Why:** ASR often gets speaker names wrong. Let users tap a speaker label to fix it. Small thing that dramatically improves output quality. Already in your TODOs.

### 17. Keyboard shortcuts — `sm`

**Why:** Power users will want: space to play/pause, left/right to skip, j/k to jump between paragraphs. Quick to add, makes the reading+listening experience feel premium.

### 18. Basic analytics/monitoring — `sm`

**Why:** You need to know what's happening post-launch. Minimal: track episodes processed, error rate, cost per episode. Could be as simple as a Convex query that aggregates episode stats. Not user-facing.

### 19. RSS feed output — `md`

**Why:** Generate an RSS feed of transcribed episodes so people can subscribe in their feed reader. "Subscribe to readable versions of this podcast." Interesting viral loop.

### 20. Auth & per-user history — `lg`

**Why:** Not needed for v0 if rate limiting is in place, but eventually people will want to see their transcription history. Convex auth is straightforward. Deprioritized because it adds friction to the first-use experience and rate limiting covers the abuse case.

---

## Summary matrix

| #   | Feature                          | Priority | Size | Category    |
| --- | -------------------------------- | -------- | ---- | ----------- |
| 1   | Rate limiting & cost protection  | P0       | md   | Infra       |
| 2   | OG metadata for shared links     | P0       | sm   | Virality    |
| 3   | Fix episode date (use pub date)  | P0       | sm   | Bug         |
| 4   | Variable playback speed          | P0       | sm   | UX          |
| 5   | Landing page / hero              | P0       | md   | Growth      |
| 6   | Parallel chunk processing        | P1       | md   | Perf        |
| 7   | Export to Markdown / copy        | P1       | sm   | Feature     |
| 8   | Share link with timestamp        | P1       | sm   | Virality    |
| 9   | Search within transcript         | P1       | sm   | UX          |
| 10  | Sticky audio player              | P1       | sm   | UX          |
| 11  | Mobile polish                    | P1       | md   | UX          |
| 12  | Error recovery & retry           | P1       | sm   | Reliability |
| 13  | Browser extension / bookmarklet  | P2       | md   | Growth      |
| 14  | Pre-populated popular podcasts   | P2       | lg   | Content     |
| 15  | Full-text search across episodes | P2       | md   | Feature     |
| 16  | Inline speaker name editing      | P2       | sm   | UX          |
| 17  | Keyboard shortcuts               | P2       | sm   | UX          |
| 18  | Basic analytics/monitoring       | P2       | sm   | Infra       |
| 19  | RSS feed output                  | P2       | md   | Feature     |
| 20  | Auth & per-user history          | P2       | lg   | Infra       |
