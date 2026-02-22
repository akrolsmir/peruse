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
    <div className="relative">
      {paragraphs.map((p, i) => {
        const isActive = currentTime >= p.start && currentTime < p.end;
        const speaker = resolveSpeaker(p.speaker, speakerNames);
        const prevSpeaker = i > 0 ? resolveSpeaker(paragraphs[i - 1].speaker, speakerNames) : null;
        const showSpeaker = speaker !== null && speaker !== prevSpeaker;

        return (
          <div key={i} className={showSpeaker && i > 0 ? "mt-6" : ""}>
            {showSpeaker && (
              <div className="mb-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {speaker}
              </div>
            )}
            <div
              className={`group relative border-l-2 py-2.5 pl-4 pr-2 transition-colors duration-200 ${
                isActive
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
              <p className="font-serif leading-relaxed text-zinc-600 dark:text-zinc-300">{p.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
