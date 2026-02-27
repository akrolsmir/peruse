peruse helps podcasters and listeners get excellent transcripts

## Why make peruse?

- Reading is great, I love reading.
  - Reading can be much faster. Typically people speak at 130wpm but read at twice that, 250wpm. Yeah, you can listen on 2x, but:
  - Reading lets you skip around, search, excerpt quotes. You're (more) in control of your attention!
- But a bunch of great content is locked behind podcasts.
  - CEOs (mostly) don't have time to write big public essays. But they're happy to sit down for two hours to talk through their views.
- Compared to essays or talks, podcasts are special for their interviewer/interviewee dynamic: allowing back and forth, debate, follow ups. A good host acts as the listener's proxy.
- I like playing with cool UXs.
  - For podcast transcripts specifically, I'm very inspired by the experience that 80K and Hope in Source offer.
  - Other podcasts that have great transcripts: Dwarkesh, Complex Systems
  - More broadly, I love the reading experiences of gwern, LessWrong, and Practical Typography
  - As well as a lot of blogs from technical folks ([jefftk.com], [kipp.ly], [venki.dev], [benkuhn.net], [ekzhang.com])
- Also: the tech is here! Transcription has fallen drastically in costs, and LLM script editing has gotten much better
- Making podcasts legible to other apps, and future LLMs! See [writing for the AIs](https://www.astralcodexten.com/p/writing-for-the-ais)
- I've also hosted/spoke on a couple podcasts, and getting good transcripts was surprisingly painful.
  - Descript is pretty good (and, also an inspiration), but it feels like Canva or Photoshop; I want Midjourney.

## What peruse offers

Now

- Upload an episode and get a good transcript
- Read it and listen to it, right here
- Upload an RSS feed to get quick access to its episodes

Soon

- Cheaper, faster, better (quality) transcripts
- Export, share?
- API access; LLM access?

## Musings

- LLMs enable all kinds of translation between content
  - Humans vary wildly in their preference and fluency across mediums (eg text vs video vs audio; shortform vs longform)
  - https://www.lesswrong.com/posts/Pa5NqtxHBkGuCh98G/great-minds-might-not-think-alike
  - Q: will future LLMs also vary a lot?
- How to incorporate fixes and edits?
  - How much to orient to WYSIWYG, wiki-like editing? vs prompting for changes?
  - Haven't seen great designs for this, unlike eg wikipedia or grokipedia or TVTropes
- Idea to explore: same content, different "lens". Transcript vs essay vs summary vs ...
  - Possible solution to differences in taste
  - See also: https://www.longtermwiki.com/
- How to avoid slop?
  - Transcripts themselves are great, since they're human generated
  - Editing pass does make a few changes I stylistically disapprove of, but basically fine for now
  - Summaries and titles are currently AI-generated, but can be sloppy.
- Principle: spend more compute (and dev time) on things that will be consumed more broadly. Eg titles, intros, summaries/descriptions. Backfill with AI for the rest.

## TODOs

- [x] player improvements:
  - [x] variable speed
  - [x] styling (center)
- episode page:
  - [x] show titles as headers
  - [x] shorter slugify (no cruft at end)
  - export entire script to markdown
  - [x] tap to change speaker description
    - (maybe more ways to edit things in general)
    - big brain: speak directly with ai to change things!!
  - [x] backlink to the podcast
  - fix: date should be from episode pub date, not our upload date
- bugs
  - [x] pass episode description as a hint to parsing => not sure this is an improvement tho
  - dropped transcript before "passion capital wins" on /social-radars-with-tom-3-speakers-align-output-mlx23ryw
  - [x] fix the timestamps so they're consistent (no jumping)
- code smells:
  - feeds should probably load 1mb of data; make a subtable instead?
  - consolidate prompts
  - consolidate formatTimestamps (?)
- style things
  - pick a better sans-serif pairing
  - og image, use feed images?
  - colors for speakers
  - dark mode? next level: custom theming based on image/banner?
- longterm:
  - Search interface over popular podcasts (eg via listennotes api? or start with a few RSS feeds?)
  - Suggest fixes (to implement via claude code?)
  - gate APIs behind login?
  - Track costs?
  - Add auth?

- [x] for postprocessing, compare json structured output to previous (non-json) -- the timestamps seem off more often now.
- maybe switch sonnet to medium effort for faster responses?

- [x] change postprocessing to create something more 80k-style. Dialog not timestamp-first; conversational but still easy to read.
  - could add clarifications eg "SWE (Software Engineer)" in parenthesis, augment eg "Holden [Karnofsky]" in brackets.
  - Could link to jargon

## Quick numbers/math

- 1 word = 1.3 tokens (or, 4 words = 3 tokens)
- People speak at 150 words/min (or 200 tok/min)
- Sonnet 4.6 averages 50 tokens/sec output
  - (This is 15x faster than human speech)
- Sonnet costs $15/mtok output or 5c/min while running
- Our pipeline maybe about 5x more tokens input, 1.3x more tokens output?
  - (eg 15k in/4k out for a 15min=3k tok interview)

## Notes

Example URL: https://api.substack.com/feed/podcast/187852154/cecdbe38125e2786cbfebe31dd083d4f.mp3 (dwarkesh podcast w/ dario, 2h)
Example URL: https://episodes.captivate.fm/episode/e45099d6-5d22-49e4-b8fd-def4040a4c04.mp3 (social radars w/ tom blomfield)
(todo: load a short, med, long snippet into default example)

choosing an ASR model off of replicate:

1. vaibhavs10/incredibly-fast-whisper has a very fast cold start, but maybe slower RTF (real-time factor).
2. nvidia/canary-qwen-2.5b on replicate has a limit of 120 minutes: https://github.com/zsxkib/cog-nvidia-canary-qwen-2.5b/blob/09ea034bdc4d930940b8d3ca0f4d499c181809af/predict.py#L86. also a very long replicate startup, like a minute or so
3. victor-upmeet/whisperx for built in diarisation. approx 4-6min of speech/1cent, and 2-3min runtime for 70min transcript

## Inspirations

- 80k podcast landing page
- Hope in Source https://hopeinsource.com/
- Dwarkesh transcripts

## Names/domains?

peruse.sh!

considerations:
script, talk, pod, article, articulate, spell
log, transcript, read, readable, follow along
word, episode, peruse

domains: .sh, .dev, .ai, .com
podsc.com, podscript.dev

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
