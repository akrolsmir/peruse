"use client";

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface RawTranscriptViewProps {
  segments: Segment[];
  currentTime: number;
  onSeek: (time: number) => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RawTranscriptView({ segments, currentTime, onSeek }: RawTranscriptViewProps) {
  return (
    <div className="space-y-px font-mono text-[13px]">
      {segments.map((seg, i) => {
        const isActive = currentTime >= seg.start && currentTime < seg.end;
        return (
          <div
            key={i}
            className={`flex gap-3 rounded px-2 py-1 transition-colors duration-200 ${
              isActive
                ? "bg-amber-50/60 dark:bg-amber-950/20"
                : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <button
              onClick={() => onSeek(seg.start)}
              className="shrink-0 tabular-nums text-[11px] leading-relaxed text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
            >
              {formatTimestamp(seg.start)}
            </button>
            <span className="leading-relaxed text-zinc-500 dark:text-zinc-400">{seg.text}</span>
          </div>
        );
      })}
    </div>
  );
}
