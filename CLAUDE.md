# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PTT (Podcast to Text) is a Next.js 16 app that transcribes podcasts using Replicate ASR models and post-processes transcripts with Claude. It uses Convex for the database with real-time sync.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start Next.js + Convex dev servers concurrently
- `bun run dev:next` — Next.js dev server only
- `bun run dev:convex` — Convex dev server only
- `bun run build` — production build
- `bun run fmt` — format with oxfmt
- `bun run fmt:check` — check formatting

No test suite is configured.

## Architecture

**Processing pipeline:** Upload URL/file → create Convex episode (pending) → fire-and-forget POST to `/api/process` → transcribe via Replicate → post-process with Claude → store results in Convex. Status progresses: `pending` → `downloading` → `transcribing` → `processing` → `done` (or `error`).

**Key directories:**
- `app/` — Next.js app router pages and API routes
- `app/api/process/route.ts` — main transcription pipeline
- `app/api/reprocess/route.ts` — re-run Claude post-processing only
- `lib/transcribe.ts` — ASR providers (Whisper, Canary-Qwen, WhisperX)
- `lib/postprocess.ts` — Claude structured output for transcript cleaning and summarization
- `convex/` — database schema and mutations/queries
- `components/` — React components with real-time Convex subscriptions

**ASR providers** (in `lib/transcribe.ts`): Three implementations of the `ASRProvider` interface — WhisperASR (default, fast), CanaryQwenASR (lower WER, slower), WhisperXASR (speaker diarization).

**Post-processing** (in `lib/postprocess.ts`): Uses Claude Sonnet with JSON schema structured outputs. Chunks transcripts into ~60-second segments for parallel processing, then generates summary + chapters.

**Database:** Single `episodes` table in Convex. Transcripts, summaries, and chapters stored as JSON strings. Slug field is indexed for lookups.

## Environment Variables

Required in `.env.local`:
- `REPLICATE_API_TOKEN` — Replicate API for ASR models
- `ANTHROPIC_API_KEY` — Claude API for post-processing
- `NEXT_PUBLIC_CONVEX_URL` — Convex frontend URL (public)
- `CONVEX_DEPLOYMENT` — Convex deployment identifier
- `HUGGINGFACE_API_KEY` — needed for WhisperX diarization
