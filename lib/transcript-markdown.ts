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

function resolveSpeaker(speaker: string | undefined, speakerNames?: string[]): string | null {
  if (!speaker) return null;
  const match = speaker.match(/SPEAKER_(\d+)/);
  if (match && speakerNames) {
    const idx = parseInt(match[1], 10);
    if (idx < speakerNames.length) return speakerNames[idx];
  }
  return speaker;
}

export function generateTranscriptMarkdown(opts: {
  title: string;
  slug: string;
  date: number;
  podcastName?: string;
  summary?: string;
  chapters: Chapter[];
  paragraphs: Paragraph[];
  speakerNames?: string[];
}): string {
  const { title, slug, date, podcastName, summary, chapters, paragraphs, speakerNames } = opts;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  if (podcastName) {
    lines.push(`This is an episode of ${podcastName}.`);
  }
  const dateStr = new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  lines.push(`Published on ${dateStr}, transcribed by peruse.`);
  lines.push(`For humans: https://peruse.sh/ep/${slug}`);
  lines.push("");

  if (summary) {
    lines.push("## Summary");
    lines.push("");
    lines.push(summary);
    lines.push("");
  }

  if (chapters.length > 0) {
    lines.push("## Chapters");
    lines.push("");
    for (const ch of chapters) {
      lines.push(`- [${formatTimestamp(ch.timestamp)}] ${ch.title}`);
    }
    lines.push("");
  }

  lines.push("## Transcript");
  lines.push("");

  // Build chapter insertion map (same logic as TranscriptView)
  const chapterInsertions = new Map<number, Chapter>();
  if (chapters.length > 0) {
    for (const ch of chapters) {
      let bestIdx = 0;
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].start >= ch.timestamp) {
          bestIdx = i;
          break;
        }
        bestIdx = i;
      }
      if (!chapterInsertions.has(bestIdx)) {
        chapterInsertions.set(bestIdx, ch);
      }
    }
  }

  let prevSpeaker: string | null = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const chapter = chapterInsertions.get(i);

    if (chapter) {
      lines.push(`### ${chapter.title} [${formatTimestamp(chapter.timestamp)}]`);
      lines.push("");
    }

    const speaker = resolveSpeaker(p.speaker, speakerNames);
    if (speaker && speaker !== prevSpeaker) {
      lines.push(`**${speaker}**`);
      lines.push("");
    }

    lines.push("" + p.text);
    lines.push("");

    prevSpeaker = speaker;
  }

  return lines.join("\n");
}
