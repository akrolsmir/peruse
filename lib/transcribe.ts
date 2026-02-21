import Replicate from "replicate";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ASRProvider {
  transcribe(audioUrl: string): Promise<TranscriptSegment[]>;
}

const MODEL_VERSION =
  "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c";

interface WhisperChunk {
  text: string;
  timestamp: [number, number];
}

interface WhisperOutput {
  text: string;
  chunks: WhisperChunk[];
}

export class ReplicateASR implements ASRProvider {
  private client: Replicate;

  constructor() {
    this.client = new Replicate();
  }

  async transcribe(audioUrl: string): Promise<TranscriptSegment[]> {
    const output = (await this.client.run(MODEL_VERSION, {
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

    // Fallback: single segment from full text
    if (output.text) {
      return [{ start: 0, end: 0, text: output.text.trim() }];
    }

    return [{ start: 0, end: 0, text: JSON.stringify(output) }];
  }
}

export function createASR(): ASRProvider {
  return new ReplicateASR();
}
