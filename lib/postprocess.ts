import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./transcribe";

export interface ProcessedParagraph {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface Chapter {
  title: string;
  timestamp: number;
}

export interface PostProcessedResult {
  paragraphs: ProcessedParagraph[];
  summary: string;
  chapters: Chapter[];
  speakerNames: string[];
}

export interface ProgressCallback {
  onChunkDone(
    paragraphs: ProcessedParagraph[],
    chunkIndex: number,
    totalChunks: number,
  ): Promise<void>;
  onSummaryDone(summary: string, chapters: Chapter[], speakerNames: string[]): Promise<void>;
}

// const MODEL = "claude-haiku-4-5-20251001";
const MODEL = "claude-sonnet-4-6";
const CHUNK_DURATION = 240; // 4 minutes in seconds
const BATCH_SIZE = 4;

const chunkSchema = {
  type: "object" as const,
  properties: {
    paragraphs: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          start: { type: "number" as const },
          end: { type: "number" as const },
          text: { type: "string" as const },
          speaker: { type: "string" as const },
        },
        required: ["start", "end", "text"] as const,
        additionalProperties: false,
      },
    },
  },
  required: ["paragraphs"] as const,
  additionalProperties: false,
};

const summarySchema = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const },
    chapters: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          timestamp: { type: "number" as const },
        },
        required: ["title", "timestamp"] as const,
        additionalProperties: false,
      },
    },
    speaker_names: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["summary", "chapters", "speaker_names"] as const,
  additionalProperties: false,
};

function chunkSegments(segments: TranscriptSegment[]): TranscriptSegment[][] {
  if (segments.length === 0) return [[]];

  const chunks: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let chunkStart = segments[0].start;

  for (const seg of segments) {
    if (seg.start - chunkStart > CHUNK_DURATION && current.length > 0) {
      chunks.push(current);
      current = [];
      chunkStart = seg.start;
    }
    current.push(seg);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// Post-processes raw ASR transcript segments into a polished, readable transcript.
//
//   Raw ASR segments (word-level, noisy)
//     │
//     ▼
//   ┌─────────────────────────────────┐
//   │  Split into ~4min chunks        │
//   └──────────────┬──────────────────┘
//                  │
//                  ▼  (parallel, batches of 4)
//   ┌─────────────────────────────────┐
//   │  Claude: clean chunk            │    Remove filler words, fix ASR
//   │  (batch of chunks in parallel)  │    errors, group into paragraphs
//   └──────────────┬──────────────────┘    w/ timestamps & speakers
//                  ▼
//   ┌─────────────────────────────────┐
//   │  Merge all cleaned paragraphs   │
//   └──────────────┬──────────────────┘
//                  ▼
//   ┌─────────────────────────────────┐
//   │  Claude: generate summary,      │
//   │  chapters, and speaker names    │
//   └──────────────┬──────────────────┘
//                  ▼
//   PostProcessedResult { paragraphs, summary, chapters, speakerNames }
//
// Episode title/description are included as context in prompts when available.
// Progress callbacks fire after each batch and after the summary step.
export async function postProcess(
  segments: TranscriptSegment[],
  progress?: ProgressCallback,
  options?: {
    speakerNames?: string[];
    title?: string;
    description?: string;
    feedDescription?: string;
  },
): Promise<PostProcessedResult> {
  const client = new Anthropic();
  const hasSpeakers = segments.some((s) => s.speaker);
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const episodeContext =
    options?.title || options?.description || options?.feedDescription
      ? `\nEpisode context:${options.title ? `\nTitle: ${options.title}` : ""}${options.description ? `\nDescription: ${options.description}` : ""}${options.feedDescription ? `\nShow description: ${options.feedDescription}` : ""}\n`
      : "";

  const chunks = chunkSegments(segments);
  // Results array indexed by chunk position to preserve ordering
  const chunkResults: ProcessedParagraph[][] = new Array(chunks.length);

  const speakerRules = hasSpeakers
    ? `
- Each paragraph MUST have a "speaker" field with the speaker label (e.g. "SPEAKER_00")
- NEVER combine text from different speakers into one paragraph — a speaker change always means a new paragraph
- Preserve the speaker label exactly as given`
    : "";

  async function processChunk(ci: number): Promise<void> {
    const chunk = chunks[ci];
    console.log(
      `[postprocess] Cleaning chunk ${ci + 1}/${chunks.length} (${chunk.length} segments)`,
    );
    const chunkText = chunk
      .map((s) => {
        const prefix = s.speaker ? ` [${s.speaker}]` : "";
        return `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]${prefix} ${s.text}`;
      })
      .join("\n");

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      output_config: {
        format: {
          type: "json_schema",
          schema: chunkSchema,
        },
      },
      messages: [
        {
          role: "user",
          content: `You are processing a podcast transcript. Clean up this transcript chunk and group it into natural paragraphs, aiming for a good reading experience.
${episodeContext}
For each paragraph, provide the start and end timestamps (in seconds) and the cleaned text.

Rules:
- Remove filler words (um, uh, like, you know) unless they add meaning
- Fix obvious speech recognition errors
- Preserve the speaker's meaning and tone, using their specific words where possible
- Group related sentences into paragraphs (2-5 sentences each). Prefer shorter paragraphs, around 30-50 words.
- Keep timestamps accurate${speakerRules}

Transcript chunk:
${chunkText}`,
        },
      ],
    });

    totalInputTokens += response.usage?.input_tokens ?? 0;
    totalOutputTokens += response.usage?.output_tokens ?? 0;
    console.log(
      `[${new Date().toISOString()}] [postprocess] Chunk ${ci + 1}/${chunks.length} done (${response.usage?.input_tokens}in/${response.usage?.output_tokens}out tokens)`,
    );

    if (response.stop_reason === "end_turn") {
      const content = response.content[0];
      if (content.type === "text") {
        const parsed = JSON.parse(content.text);
        chunkResults[ci] = parsed.paragraphs;
      }
    } else {
      console.warn(
        `[postprocess] Chunk ${ci + 1} stop_reason=${response.stop_reason}, using raw text`,
      );
      chunkResults[ci] =
        chunk.length > 0
          ? [
              {
                start: chunk[0].start,
                end: chunk[chunk.length - 1].end,
                text: chunk.map((s) => s.text).join(" "),
              },
            ]
          : [];
    }
  }

  // Process chunks in parallel batches
  for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
    const batch = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);
    console.log(
      `[postprocess] Processing batch: chunks ${batchStart + 1}-${batchEnd} of ${chunks.length}`,
    );
    await Promise.all(batch.map(processChunk));

    if (progress) {
      const allSoFar = chunkResults.slice(0, batchEnd).flat();
      await progress.onChunkDone(allSoFar, batchEnd - 1, chunks.length);
    }
  }

  const allParagraphs = chunkResults.flat();

  // Generate summary and chapters
  const fullText = allParagraphs
    .map((p) => {
      const prefix = p.speaker ? `[${p.speaker}] ` : "";
      return `${prefix}${p.start.toFixed(1)}s - ${p.end.toFixed(1)}s: ${p.text}`;
    })
    .join("\n\n");

  console.log(
    `[postprocess] Generating summary and chapters (${allParagraphs.length} paragraphs, ${fullText.length} chars)`,
  );
  const summaryResponse = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      format: {
        type: "json_schema",
        schema: summarySchema,
      },
    },
    messages: [
      {
        role: "user",
        content: `Here is a cleaned podcast transcript. Generate a summary, chapter titles, and speaker names.
${episodeContext}
Transcript:
${fullText}

For the summary: write 1-2 short, punchy paragraphs summarizing the podcast episode.

For chapter titles:
- Create chapter titles wherever the topic shifts. Approximately once every 2-8 minutes, but longer is fine.
- Titles should be catchy and descriptive.
- Sentence fragments and questions are good. Avoid sounding like AI slop.
- Use sentence case -- only capitalize the first letter, except for proper nouns.
- Chapter timestamps should correspond to where that topic begins, in seconds.

${
  hasSpeakers
    ? `

For speaker_names: The transcript has speaker labels like SPEAKER_00, SPEAKER_01, etc. 
Infer the real name of each speaker from context (introductions, references to each other). 
Return an array where index 0 is SPEAKER_00's name, index 1 is SPEAKER_01's name, etc. 
If you cannot determine a name, use the raw label (e.g. "SPEAKER_00").`
    : ""
}`,
      },
    ],
  });

  let summary = "";
  let chapters: Chapter[] = [];
  let speakerNames: string[] = [];

  totalInputTokens += summaryResponse.usage?.input_tokens ?? 0;
  totalOutputTokens += summaryResponse.usage?.output_tokens ?? 0;
  console.log(
    `[postprocess] Summary done (${summaryResponse.usage?.input_tokens}in/${summaryResponse.usage?.output_tokens}out tokens)`,
  );

  if (summaryResponse.stop_reason === "end_turn") {
    const summaryContent = summaryResponse.content[0];
    if (summaryContent.type === "text") {
      const parsed = JSON.parse(summaryContent.text);
      summary = parsed.summary;
      chapters = parsed.chapters;
      speakerNames = parsed.speaker_names || [];
    }
  } else {
    console.warn(`[postprocess] Summary stop_reason=${summaryResponse.stop_reason}`);
    summary = "Summary generation failed.";
    chapters = [{ title: "Full Episode", timestamp: 0 }];
  }

  if (progress) {
    await progress.onSummaryDone(summary, chapters, speakerNames);
  }

  console.log(`[postprocess] Total tokens: ${totalInputTokens} input, ${totalOutputTokens} output`);

  return { paragraphs: allParagraphs, summary, chapters, speakerNames };
}
