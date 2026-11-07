import Replicate from "replicate";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export type ASRModel = "whisper" | "canary-qwen" | "whisperx" | "mai-transcribe-2";

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

// --- MAI-Transcribe-2 (Microsoft AI, served via OpenRouter) ---

const OPENROUTER_TRANSCRIPTIONS_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
const MAI_MODEL = "microsoft/mai-transcribe-2";

interface OpenRouterSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  speaker_label?: string;
}

interface OpenRouterTranscription {
  text: string;
  duration?: number;
  language?: string;
  segments?: OpenRouterSegment[];
  usage?: { seconds?: number; cost?: number };
}

// OpenRouter rejects request bodies over 50MB, and MAI-Transcribe-2 doesn't accept
// URL input through OpenRouter, so the audio has to be inlined as base64 (4/3 overhead).
const OPENROUTER_MAX_BODY_BYTES = 50 * 1024 * 1024;
const MAX_INLINE_AUDIO_BYTES = Math.floor((OPENROUTER_MAX_BODY_BYTES * 3) / 4) - 64 * 1024;

function formatFromContentType(contentType: string | null, audioUrl: string): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3";
  if (ct.includes("wav")) return "wav";
  if (ct.includes("flac")) return "flac";
  if (ct.includes("ogg") || ct.includes("opus")) return "ogg";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("aac")) return "aac";
  if (ct.includes("mp4") || ct.includes("m4a")) return "m4a";
  const ext = new URL(audioUrl).pathname.toLowerCase().split(".").pop() ?? "";
  return ["mp3", "wav", "flac", "m4a", "ogg", "webm", "aac"].includes(ext) ? ext : "mp3";
}

class MAITranscribeASR implements ASRProvider {
  async transcribe(audioUrl: string): Promise<TranscriptSegment[]> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error(`Failed to download audio (${audioRes.status})`);
    const audio = Buffer.from(await audioRes.arrayBuffer());
    if (audio.length > MAX_INLINE_AUDIO_BYTES) {
      const mb = (audio.length / 1e6).toFixed(1);
      const maxMb = (MAX_INLINE_AUDIO_BYTES / 1e6).toFixed(0);
      throw new Error(
        `Audio is ${mb}MB; MAI-Transcribe-2 via OpenRouter accepts at most ~${maxMb}MB inline. Re-encode at a lower bitrate or pick another model.`,
      );
    }
    const format = formatFromContentType(audioRes.headers.get("content-type"), audioUrl);

    const res = await fetch(OPENROUTER_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MAI_MODEL,
        input_audio: { data: audio.toString("base64"), format },
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        diarize: true,
        provider: {
          options: {
            azure: {
              // Note: passing a maxSpeakers hint here makes the provider return 400
              diarization: { enabled: true },
              // Keep fillers; Claude post-processing handles readability
              enhancedMode: { modelOptions: { transcribeStyle: "verbatim" } },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenRouter transcription failed (${res.status}): ${detail.slice(0, 500)}`);
    }

    const output = (await res.json()) as OpenRouterTranscription;

    if (output.segments && Array.isArray(output.segments) && output.segments.length > 0) {
      return output.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        ...(seg.speaker !== undefined
          ? // Match WhisperX's SPEAKER_00 convention so post-processing treats both the same
            { speaker: `SPEAKER_${String(seg.speaker).padStart(2, "0")}` }
          : seg.speaker_label
            ? { speaker: seg.speaker_label }
            : {}),
      }));
    }

    if (output.text) {
      return [{ start: 0, end: 0, text: output.text.trim() }];
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
    case "mai-transcribe-2":
      return new MAITranscribeASR();
    case "whisper":
    default:
      return new WhisperASR(client);
  }
}
