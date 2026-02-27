"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef, useState } from "react";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/audio-player";
import { TranscriptView } from "@/components/transcript-view";
import { RawTranscriptView } from "@/components/raw-transcript-view";
import { SyncedTranscriptView } from "@/components/synced-transcript-view";
import { ChapterNav } from "@/components/chapter-nav";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

interface Chapter {
  title: string;
  timestamp: number;
}

export function EpisodeDetail({ slug }: { slug: string }) {
  const episode = useQuery(api.episodes.getBySlug, { slug });
  const feed = useQuery(api.feeds.getById, episode?.feedId ? { id: episode.feedId } : "skip");
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [viewMode, setViewMode] = useState<"cleaned" | "both" | "raw" | "json">("cleaned");

  if (episode === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading episode...</span>
      </div>
    );
  }

  if (episode === null) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-zinc-500">Episode not found.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-amber-600 hover:text-amber-500">
          &larr; Back to episodes
        </Link>
      </div>
    );
  }

  const isDone = episode.status === "done";
  const isProcessing = episode.status === "processing";
  const isError = episode.status === "error";
  const hasContent = isDone || isProcessing;

  const paragraphs = episode.transcript ? JSON.parse(episode.transcript) : [];
  const chapters: Chapter[] = episode.chapters ? JSON.parse(episode.chapters) : [];
  const rawSegments = episode.rawTranscript ? JSON.parse(episode.rawTranscript) : [];
  const speakerNames: string[] | undefined = episode.speakerNames ?? undefined;
  const audioUrl = episode.audioUrl || episode.url;
  const showPlayer = hasContent || paragraphs.length > 0;
  const hasRaw = rawSegments.length > 0;

  const handleSeek = (time: number) => {
    playerRef.current?.seekTo(time);
  };

  const showChapterNav = chapters.length > 0 && (hasContent || paragraphs.length > 0);

  return (
    <>
      {/* Chapter sidebar — positioned relative to the page, not the transcript */}
      {showChapterNav && (
        <div className="hidden lg:block lg:fixed lg:right-[calc(50vw-32rem-8rem)] lg:top-0 lg:w-48 lg:pt-10 xl:right-[calc(50vw-32rem-10rem)] xl:w-52">
          <ChapterNav chapters={chapters} onSeek={handleSeek} />
        </div>
      )}

      {/* Header */}
      <header className="mb-10">
        <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
          <Link
            href={feed ? `/feeds/${feed.slug}` : "/"}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            {feed ? (
              <span className="inline-flex items-center gap-2">
                {feed.imageUrl && (
                  <img src={feed.imageUrl} alt="" className="h-5 w-5 rounded object-cover" />
                )}
                {feed.title}
              </span>
            ) : (
              "Back"
            )}
          </Link>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {episode.title}
        </h1>
        <time className="mt-2 block text-sm text-zinc-400">
          {new Date(episode.createdAt).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </header>

      {/* Waiting state */}
      {!hasContent && !isError && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Transcribing your episode
          </p>
          <p className="mt-1 text-xs text-zinc-400">This usually takes 1-2 minutes.</p>
        </div>
      )}

      {/* Error state */}
      {isError && !paragraphs.length && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-10 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Processing failed</p>
          <p className="mt-1 text-xs text-red-500/70 dark:text-red-400/50">
            {episode.error || "An unexpected error occurred."}
          </p>
        </div>
      )}

      {/* Main content */}
      {(hasContent || paragraphs.length > 0) && (
        <div className="space-y-10">
          {/* Processing banner */}
          {isProcessing && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200/50 bg-amber-50/50 px-4 py-3 dark:border-amber-800/30 dark:bg-amber-950/20">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                Processing &mdash; new content will appear as it&rsquo;s ready
              </span>
            </div>
          )}

          {/* Summary */}
          {episode.summary && (
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                Summary
              </h2>
              <div className="whitespace-pre-line font-serif text-zinc-600 dark:text-zinc-300">
                {episode.summary}
              </div>
            </section>
          )}

          {/* Transcript with chapter sidebar */}
          {(paragraphs.length > 0 || hasRaw) && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Transcript
                  {isProcessing && (
                    <span className="ml-2 normal-case tracking-normal">
                      ({paragraphs.length} paragraphs)
                    </span>
                  )}
                </h2>
                {hasRaw && paragraphs.length > 0 && (
                  <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
                    {(["cleaned", "both", "raw", "json"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                          viewMode === mode
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        }`}
                      >
                        {mode === "json" ? "JSON" : mode}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {viewMode === "json" && hasRaw ? (
                  <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-[12px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                    {JSON.stringify(JSON.parse(episode.rawTranscript!), null, 2)}
                  </pre>
                ) : viewMode === "both" && hasRaw && paragraphs.length > 0 ? (
                  <div className="ml-[calc(-50vw+50%)] w-screen">
                    <div className="mx-auto max-w-5xl px-4">
                      <div className="mb-2 grid grid-cols-2 gap-6">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
                          Cleaned
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
                          Raw
                        </div>
                      </div>
                      <SyncedTranscriptView
                        paragraphs={paragraphs}
                        segments={rawSegments}
                        speakerNames={speakerNames}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                      />
                    </div>
                  </div>
                ) : viewMode === "raw" && hasRaw ? (
                  <RawTranscriptView
                    segments={rawSegments}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                ) : paragraphs.length > 0 ? (
                  <TranscriptView
                    paragraphs={paragraphs}
                    chapters={chapters}
                    speakerNames={speakerNames}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                ) : hasRaw ? (
                  <RawTranscriptView
                    segments={rawSegments}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                ) : null}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Sticky bottom player */}
      {showPlayer && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80">
          <AudioPlayer ref={playerRef} src={audioUrl} onTimeUpdate={setCurrentTime} />
        </div>
      )}
    </>
  );
}
