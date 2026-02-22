import Replicate from "replicate";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export type ASRModel = "whisper" | "canary-qwen" | "whisperx";

export interface ASROptions {
  minSpeakers?: number;
}

export interface ASRProvider {
  transcribe(audioUrl: string, options?: ASROptions): Promise<TranscriptSegment[]>;
}

// --- Whisper ---

const WHISPER_VERSION =
  "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c";

interface WhisperChunk {
  text: string;
  timestamp: [number, number];
}

interface WhisperOutput {
  text: string;
  chunks: WhisperChunk[];
}

class WhisperASR implements ASRProvider {
  private client: Replicate;

  constructor(client: Replicate) {
    this.client = client;
  }

  async transcribe(audioUrl: string): Promise<TranscriptSegment[]> {
    const output = (await this.client.run(WHISPER_VERSION, {
      input: {
        audio: audioUrl,
        task: "transcribe",
        batch_size: 24,
        return_timestamps: true,
      },
    })) as WhisperOutput;

    if (output.chunks && Array.isArray(output.chunks)) {
      return output.chunks.map((chunk) => ({
        start: chunk.timestamp[0],
        end: chunk.timestamp[1],
        text: chunk.text.trim(),
      }));
    }

    if (output.text) {
      return [{ start: 0, end: 0, text: output.text.trim() }];
    }

    return [{ start: 0, end: 0, text: JSON.stringify(output) }];
  }
}

// --- Canary-Qwen ---

const CANARY_VERSION =
  "nvidia/canary-qwen-2.5b:afba731fc7a4082730943a246233b09c7fa3dfb2c24b07fe199c1408a7c8cb2f";

class CanaryQwenASR implements ASRProvider {
  private client: Replicate;

  constructor(client: Replicate) {
    this.client = client;
  }

  async transcribe(audioUrl: string): Promise<TranscriptSegment[]> {
    const output = (await this.client.run(CANARY_VERSION, {
      input: {
        audio: audioUrl,
        include_timestamps: true,
      },
    })) as unknown as string;

    return this.parseTimestampedString(output);
  }

  private parseTimestampedString(text: string): TranscriptSegment[] {
    const parts = text.split(/(\[\d+:\d{2}(?::\d{2})? - \d+:\d{2}(?::\d{2})?])/);
    const segments: TranscriptSegment[] = [];

    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i];
      const body = (parts[i + 1] || "").trim();
      const m = header.match(/\[(\d+:\d{2}(?::\d{2})?) - (\d+:\d{2}(?::\d{2})?)\]/);
      if (m && body) {
        segments.push({
          start: this.parseTimestamp(m[1]),
          end: this.parseTimestamp(m[2]),
          text: body,
        });
      }
    }

    if (segments.length === 0 && text.trim()) {
      return [{ start: 0, end: 0, text: text.trim() }];
    }

    return segments;
  }

  private parseTimestamp(ts: string): number {
    const parts = ts.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }
}

// --- WhisperX ---

const WHISPERX_VERSION =
  "victor-upmeet/whisperx:84d2ad2d6194fe98a17d2b60bef1c7f910c46b2f6fd38996ca457afd9c8abfcb";

interface WhisperXSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface WhisperXOutput {
  segments: WhisperXSegment[];
  detected_language: string;
}

class WhisperXASR implements ASRProvider {
  private client: Replicate;

  constructor(client: Replicate) {
    this.client = client;
  }

  async transcribe(audioUrl: string, options?: ASROptions): Promise<TranscriptSegment[]> {
    const input: Record<string, unknown> = {
      audio_file: audioUrl,
      language: "en",
      diarization: true,
      // We don't currently use word-level timestamps, but aligning output improves diarization accuracy
      align_output: true,
      batch_size: 32,
      huggingface_access_token: process.env.HUGGINGFACE_API_KEY,
    };
    if (options?.minSpeakers) {
      input.min_speakers = options.minSpeakers;
    }

    const output = (await this.client.run(WHISPERX_VERSION, { input })) as WhisperXOutput;

    if (output.segments && Array.isArray(output.segments)) {
      return output.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        speaker: seg.speaker,
      }));
    }

    return [{ start: 0, end: 0, text: JSON.stringify(output) }];
  }
}

// --- Factory ---

export function createASR(model: ASRModel = "whisper"): ASRProvider {
  const client = new Replicate();
  switch (model) {
    case "canary-qwen":
      return new CanaryQwenASR(client);
    case "whisperx":
      return new WhisperXASR(client);
    case "whisper":
    default:
      return new WhisperASR(client);
  }
}
