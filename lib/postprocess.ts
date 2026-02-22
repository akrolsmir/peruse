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
const CHUNK_DURATION = 60; // 1 minute in seconds

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

export async function postProcess(
  segments: TranscriptSegment[],
  progress?: ProgressCallback,
  options?: { speakerNames?: string[] },
): Promise<PostProcessedResult> {
  const client = new Anthropic();
  const hasSpeakers = segments.some((s) => s.speaker);

  const chunks = chunkSegments(segments);
  const allParagraphs: ProcessedParagraph[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    console.log(
      `[postprocess] Cleaning chunk ${ci + 1}/${chunks.length} (${chunk.length} segments)`,
    );
    const chunkText = chunk
      .map((s) => {
        const prefix = s.speaker ? ` [${s.speaker}]` : "";
        return `[${formatTime(s.start)} - ${formatTime(s.end)}]${prefix} ${s.text}`;
      })
      .join("\n");

    const speakerRules = hasSpeakers
      ? `
- Each paragraph MUST have a "speaker" field with the speaker label (e.g. "SPEAKER_00")
- NEVER combine text from different speakers into one paragraph — a speaker change always means a new paragraph
- Preserve the speaker label exactly as given`
      : "";

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: {
        format: {
          type: "json_schema",
          schema: chunkSchema,
        },
      },
      messages: [
        {
          role: "user",
          content: `You are processing a podcast transcript. Clean up this transcript chunk and group it into natural paragraphs.

For each paragraph, provide the start and end timestamps (in seconds) and the cleaned text.

Rules:
- Remove filler words (um, uh, like, you know) unless they add meaning
- Fix obvious speech recognition errors
- Group related sentences into paragraphs (3-6 sentences each)
- Preserve the speaker's meaning and tone
- Keep timestamps accurate${speakerRules}

Transcript chunk:
${chunkText}`,
        },
      ],
    });

    console.log(
      `[${new Date().toISOString()}] [postprocess] Chunk ${ci + 1}/${chunks.length} done (${response.usage?.input_tokens}in/${response.usage?.output_tokens}out tokens)`,
    );

    let chunkParagraphs: ProcessedParagraph[] = [];

    if (response.stop_reason === "end_turn") {
      const content = response.content[0];
      if (content.type === "text") {
        const parsed = JSON.parse(content.text);
        chunkParagraphs = parsed.paragraphs;
      }
    } else {
      console.warn(
        `[postprocess] Chunk ${ci + 1} stop_reason=${response.stop_reason}, using raw text`,
      );
      if (chunk.length > 0) {
        chunkParagraphs = [
          {
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map((s) => s.text).join(" "),
          },
        ];
      }
    }

    allParagraphs.push(...chunkParagraphs);

    if (progress) {
      await progress.onChunkDone(allParagraphs, ci, chunks.length);
    }
  }

  // Generate summary and chapters
  const fullText = allParagraphs
    .map((p) => {
      const prefix = p.speaker ? `[${p.speaker}] ` : "";
      return `${prefix}${p.text}`;
    })
    .join("\n\n");

  const speakerNamesInstruction = hasSpeakers
    ? `

For speaker_names: The transcript has speaker labels like SPEAKER_00, SPEAKER_01, etc. Infer the real name of each speaker from context (introductions, references to each other). Return an array where index 0 is SPEAKER_00's name, index 1 is SPEAKER_01's name, etc. If you cannot determine a name, use the raw label (e.g. "SPEAKER_00").`
    : "";

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
        content: `Here is a cleaned podcast transcript. Generate a summary and chapter list.

Transcript:
${fullText}

For the summary: write 2-3 paragraphs summarizing the podcast episode.

For chapters:
- Create 4-8 chapters based on topic shifts
- Use descriptive titles
- Timestamps should correspond to where that topic begins (in seconds)${speakerNamesInstruction}`,
      },
    ],
  });

  let summary = "";
  let chapters: Chapter[] = [];
  let speakerNames: string[] = [];

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

  return { paragraphs: allParagraphs, summary, chapters, speakerNames };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
