"use client";

interface Paragraph {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface TranscriptViewProps {
  paragraphs: Paragraph[];
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

export function TranscriptView({
  paragraphs,
  speakerNames,
  currentTime,
  onSeek,
}: TranscriptViewProps) {
  return (
    <div className="space-y-1">
      {paragraphs.map((p, i) => {
        const isActive = currentTime >= p.start && currentTime < p.end;
        const speaker = resolveSpeaker(p.speaker, speakerNames);
        return (
          <div
            key={i}
            className={`border-l-2 py-3 pl-4 pr-2 transition-colors duration-300 ${
              isActive
                ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
                : "border-transparent hover:border-zinc-200 hover:bg-zinc-50/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
            }`}
          >
            <button
              onClick={() => onSeek(p.start)}
              className="mb-1.5 font-mono text-[11px] tabular-nums text-amber-600 transition-colors hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
            >
              {formatTimestamp(p.start)}
            </button>
            {speaker && (
              <span className="mb-1 block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {speaker}
              </span>
            )}
            <p className="font-serif text-zinc-600 dark:text-zinc-300">{p.text}</p>
          </div>
        );
      })}
    </div>
  );
}
