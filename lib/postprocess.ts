import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./transcribe";

export interface ProcessedParagraph {
  start: number;
  end: number;
  text: string;
}

export interface Chapter {
  title: string;
  timestamp: number;
}

export interface PostProcessedResult {
  paragraphs: ProcessedParagraph[];
  summary: string;
  chapters: Chapter[];
}

export interface ProgressCallback {
  onChunkDone(paragraphs: ProcessedParagraph[], chunkIndex: number, totalChunks: number): Promise<void>;
  onSummaryDone(summary: string, chapters: Chapter[]): Promise<void>;
}

const CHUNK_DURATION = 60; // 1 minute in seconds

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

function chunkSegments(
  segments: TranscriptSegment[]
): TranscriptSegment[][] {
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
  progress?: ProgressCallback
): Promise<PostProcessedResult> {
  const client = new Anthropic();

  const chunks = chunkSegments(segments);
  const allParagraphs: ProcessedParagraph[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    console.log(`[postprocess] Cleaning chunk ${ci + 1}/${chunks.length} (${chunk.length} segments)`);
    const chunkText = chunk
      .map(
        (s) =>
          `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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
- Keep timestamps accurate

Transcript chunk:
${chunkText}

Respond with ONLY raw JSON (no markdown, no code fences, no backticks). Use this exact format:
{"paragraphs": [{"start": 0.0, "end": 15.5, "text": "Cleaned paragraph text here."}]}`,
        },
      ],
    });

    console.log(`[${new Date().toISOString()}] [postprocess] Chunk ${ci + 1}/${chunks.length} done (${response.usage?.input_tokens}in/${response.usage?.output_tokens}out tokens)`);
    const content = response.content[0];
    let chunkParagraphs: ProcessedParagraph[] = [];

    if (content.type === "text") {
      try {
        const parsed = JSON.parse(stripCodeFence(content.text));
        chunkParagraphs = parsed.paragraphs;
      } catch {
        console.warn(`[postprocess] Chunk ${ci + 1} returned invalid JSON, using raw text`);
        if (chunk.length > 0) {
          chunkParagraphs = [{
            start: chunk[0].start,
            end: chunk[chunk.length - 1].end,
            text: chunk.map((s) => s.text).join(" "),
          }];
        }
      }
    }

    allParagraphs.push(...chunkParagraphs);

    if (progress) {
      await progress.onChunkDone(allParagraphs, ci, chunks.length);
    }
  }

  // Generate summary and chapters
  const fullText = allParagraphs.map((p) => p.text).join("\n\n");

  console.log(`[postprocess] Generating summary and chapters (${allParagraphs.length} paragraphs, ${fullText.length} chars)`);
  const summaryResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Here is a cleaned podcast transcript. Generate a summary and chapter list.

Transcript:
${fullText}

Respond with ONLY raw JSON (no markdown, no code fences, no backticks). Use this exact format:
{
  "summary": "A 2-3 paragraph summary of the podcast episode.",
  "chapters": [
    {"title": "Chapter title", "timestamp": 0.0}
  ]
}

For chapters:
- Create 4-8 chapters based on topic shifts
- Use descriptive titles
- Timestamps should correspond to where that topic begins (in seconds)`,
      },
    ],
  });

  let summary = "";
  let chapters: Chapter[] = [];

  console.log(`[postprocess] Summary done (${summaryResponse.usage?.input_tokens}in/${summaryResponse.usage?.output_tokens}out tokens)`);
  const summaryContent = summaryResponse.content[0];
  if (summaryContent.type === "text") {
    try {
      const parsed = JSON.parse(stripCodeFence(summaryContent.text));
      summary = parsed.summary;
      chapters = parsed.chapters;
    } catch {
      summary = "Summary generation failed.";
      chapters = [{ title: "Full Episode", timestamp: 0 }];
    }
  }

  if (progress) {
    await progress.onSummaryDone(summary, chapters);
  }

  return { paragraphs: allParagraphs, summary, chapters };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
