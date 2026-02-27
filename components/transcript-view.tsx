"use client";

import { useState, useRef, useEffect } from "react";
import { formatTimestamp } from "@/lib/format";

interface Paragraph {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface Chapter {
  title: string;
  timestamp: number;
}

interface TranscriptViewProps {
  paragraphs: Paragraph[];
  chapters?: Chapter[];
  speakerNames?: string[];
  currentTime: number;
  highlightedParagraph?: number | null;
  onSeek: (time: number) => void;
  onSpeakerNameChange?: (index: number, name: string) => void;
}

function resolveSpeaker(speaker: string | undefined, speakerNames?: string[]): string | null {
  if (!speaker) return null;
  const match = speaker.match(/SPEAKER_(\d+)/);
  if (match && speakerNames) {
    const idx = parseInt(match[1], 10);
    if (idx < speakerNames.length) return speakerNames[idx];
  }
  return speaker;
}

function speakerIndex(speaker: string | undefined): number | null {
  if (!speaker) return null;
  const match = speaker.match(/SPEAKER_(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function EditableSpeakerName({
  name,
  onCommit,
}: {
  name: string;
  onCommit: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onCommit(trimmed);
    } else {
      setValue(name);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-sm font-semibold text-zinc-900 outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-amber-500"
        autoFocus
      />
    );
  }

  return (
    <span className="group/speaker inline-flex items-center gap-1.5">
      <span>{name}</span>
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center opacity-0 transition-opacity group-hover/speaker:opacity-100"
        title="Edit speaker name"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-400 hover:text-amber-500 dark:text-zinc-500 dark:hover:text-amber-400"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </button>
    </span>
  );
}

export function TranscriptView({
  paragraphs,
  chapters,
  speakerNames,
  currentTime,
  highlightedParagraph,
  onSeek,
  onSpeakerNameChange,
}: TranscriptViewProps) {
  // Build a map of paragraph index → chapter to insert before it
  const chapterInsertions = new Map<number, Chapter>();
  if (chapters && chapters.length > 0) {
    for (const ch of chapters) {
      // Find the first paragraph that starts at or after this chapter's timestamp
      let bestIdx = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].start >= ch.timestamp) {
          bestIdx = i;
          break;
        }
        bestIdx = i;
      }
      // Only insert if this index doesn't already have a chapter, or this one is earlier
      if (!chapterInsertions.has(bestIdx)) {
        chapterInsertions.set(bestIdx, ch);
      }
    }
  }

  return (
    <div className="relative">
      {paragraphs.map((p, i) => {
        const isActive = currentTime >= p.start && currentTime < p.end;
        const speaker = resolveSpeaker(p.speaker, speakerNames);
        const prevSpeaker = i > 0 ? resolveSpeaker(paragraphs[i - 1].speaker, speakerNames) : null;
        const showSpeaker = speaker !== null && speaker !== prevSpeaker;
        const chapter = chapterInsertions.get(i);

        const isHighlighted = highlightedParagraph === i;

        return (
          <div key={i} id={`p-${i}`} className="scroll-mt-24">
            {chapter && (
              <div
                id={`chapter-${chapters!.indexOf(chapter)}`}
                className="scroll-mt-8 pt-14 first:pt-0"
              >
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-xl font-semibold mt-6 text-zinc-900 dark:text-zinc-50">
                    {chapter.title}
                  </h2>
                  <button
                    onClick={() => onSeek(chapter.timestamp)}
                    className="shrink-0 font-mono text-xs tabular-nums text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    {formatTimestamp(chapter.timestamp)}
                  </button>
                </div>
              </div>
            )}
            <div className={showSpeaker && i > 0 && !chapter ? "mt-6" : ""}>
              {showSpeaker && (
                <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {onSpeakerNameChange && speakerIndex(p.speaker) !== null ? (
                    <EditableSpeakerName
                      name={speaker!}
                      onCommit={(newName) =>
                        onSpeakerNameChange(speakerIndex(p.speaker)!, newName)
                      }
                    />
                  ) : (
                    speaker
                  )}
                </div>
              )}
              <div
                className={`group relative border-l-2 py-2.5 pl-4 pr-2 transition-colors duration-200 ${
                  isActive || isHighlighted
                    ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
                    : "border-transparent hover:border-zinc-200 hover:bg-zinc-50/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
                }`}
              >
                <button
                  onClick={() => onSeek(p.start)}
                  className={`absolute -left-22 top-0 bottom-0 flex w-24 cursor-pointer items-start justify-end pr-6 pt-3 font-mono text-[11px] tabular-nums transition-opacity duration-200 ${
                    isActive
                      ? "text-amber-600 opacity-100 dark:text-amber-400"
                      : "text-zinc-400 opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:text-zinc-500 dark:hover:text-amber-400"
                  }`}
                >
                  {formatTimestamp(p.start)}
                </button>
                <p className="font-serif text-base md:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {p.text}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
