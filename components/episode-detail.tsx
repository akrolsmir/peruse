"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef, useState } from "react";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/audio-player";
import { TranscriptView } from "@/components/transcript-view";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

interface Chapter {
  title: string;
  timestamp: number;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EpisodeDetail({ slug }: { slug: string }) {
  const episode = useQuery(api.episodes.getBySlug, { slug });
  const playerRef = useRef<AudioPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(0);

  if (episode === undefined) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  if (episode === null) {
    return (
      <div>
        <p className="text-sm text-zinc-500">Episode not found.</p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
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
  const chapters: Chapter[] = episode.chapters
    ? JSON.parse(episode.chapters)
    : [];
  const audioUrl = episode.audioUrl || episode.url;

  const handleSeek = (time: number) => {
    playerRef.current?.seekTo(time);
  };

  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {episode.title}
          </h1>
          <StatusBadge status={episode.status} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {new Date(episode.createdAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {!hasContent && !isError && (
        <div className="rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <StatusBadge status={episode.status} />
          <p className="mt-4 text-sm text-zinc-500">
            Your episode is being processed. This page will update automatically.
          </p>
        </div>
      )}

      {isError && !paragraphs.length && (
        <div className="rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <StatusBadge status={episode.status} />
          <p className="mt-4 text-sm text-zinc-500">
            {episode.error || "An error occurred during processing."}
          </p>
        </div>
      )}

      {(hasContent || paragraphs.length > 0) && (
        <div className="space-y-8">
          <AudioPlayer
            ref={playerRef}
            src={audioUrl}
            onTimeUpdate={setCurrentTime}
          />

          {isProcessing && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Processing transcript — new paragraphs will appear as they're ready
            </div>
          )}

          {episode.summary && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Summary
              </h2>
              <div className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {episode.summary}
              </div>
            </section>
          )}

          {chapters.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Chapters
              </h2>
              <div className="space-y-1">
                {chapters.map((ch, i) => (
                  <button
                    key={i}
                    onClick={() => handleSeek(ch.timestamp)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                      {formatTimestamp(ch.timestamp)}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {ch.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {paragraphs.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Transcript
                {isProcessing && (
                  <span className="ml-2 text-sm font-normal text-zinc-400">
                    ({paragraphs.length} paragraphs so far)
                  </span>
                )}
              </h2>
              <TranscriptView
                paragraphs={paragraphs}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            </section>
          )}
        </div>
      )}
    </>
  );
}
