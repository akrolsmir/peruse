"use client";

interface Paragraph {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface SyncedTranscriptViewProps {
  paragraphs: Paragraph[];
  segments: Segment[];
  speakerNames?: string[];
  currentTime: number;
  onSeek: (time: number) => void;
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

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SyncedRow {
  cleaned: Paragraph | null;
  rawSegments: Segment[];
}

function buildSyncedRows(paragraphs: Paragraph[], segments: Segment[]): SyncedRow[] {
  const rows: SyncedRow[] = [];
  let rawIdx = 0;

  for (const para of paragraphs) {
    const matching: Segment[] = [];
    while (rawIdx < segments.length && segments[rawIdx].start < para.end) {
      matching.push(segments[rawIdx]);
      rawIdx++;
    }
    rows.push({ cleaned: para, rawSegments: matching });
  }

  // Trailing raw segments beyond the last cleaned paragraph
  if (rawIdx < segments.length) {
    rows.push({ cleaned: null, rawSegments: segments.slice(rawIdx) });
  }

  return rows;
}

export function SyncedTranscriptView({
  paragraphs,
  segments,
  speakerNames,
  currentTime,
  onSeek,
}: SyncedTranscriptViewProps) {
  const rows = buildSyncedRows(paragraphs, segments);

  return (
    <div>
      {rows.map((row, i) => {
        const isCleanedActive =
          row.cleaned !== null && currentTime >= row.cleaned.start && currentTime < row.cleaned.end;
        const speaker = row.cleaned ? resolveSpeaker(row.cleaned.speaker, speakerNames) : null;

        return (
          <div
            key={i}
            className="grid grid-cols-2 gap-6 border-t border-zinc-100 py-1 first:border-t-0 dark:border-zinc-800/50"
          >
            {/* Cleaned column */}
            <div
              className={`border-l-2 py-3 pl-4 pr-2 transition-colors duration-300 ${
                isCleanedActive
                  ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-transparent"
              }`}
            >
              {row.cleaned && (
                <>
                  <button
                    onClick={() => onSeek(row.cleaned!.start)}
                    className="mb-1.5 font-mono text-[11px] tabular-nums text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    {formatTimestamp(row.cleaned.start)}
                  </button>
                  {speaker && (
                    <span className="mb-1 block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      {speaker}
                    </span>
                  )}
                  <p className="font-serif text-zinc-600 dark:text-zinc-300">{row.cleaned.text}</p>
                </>
              )}
            </div>

            {/* Raw column */}
            <div className="space-y-px py-2 font-mono text-[13px]">
              {row.rawSegments.map((seg, j) => {
                const isSegActive = currentTime >= seg.start && currentTime < seg.end;
                return (
                  <div
                    key={j}
                    className={`flex gap-3 rounded px-2 py-1 transition-colors duration-200 ${
                      isSegActive ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <button
                      onClick={() => onSeek(seg.start)}
                      className="shrink-0 tabular-nums text-[11px] leading-relaxed text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      {formatTimestamp(seg.start)}
                    </button>
                    <span className="leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {seg.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
