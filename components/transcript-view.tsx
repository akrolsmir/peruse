"use client";

interface Paragraph {
  start: number;
  end: number;
  text: string;
}

interface TranscriptViewProps {
  paragraphs: Paragraph[];
  currentTime: number;
  onSeek: (time: number) => void;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptView({
  paragraphs,
  currentTime,
  onSeek,
}: TranscriptViewProps) {
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => {
        const isActive = currentTime >= p.start && currentTime < p.end;
        return (
          <div
            key={i}
            className={`rounded-lg p-3 transition-colors ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <button
              onClick={() => onSeek(p.start)}
              className="mb-1 text-xs font-mono tabular-nums text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              {formatTimestamp(p.start)}
            </button>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {p.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
