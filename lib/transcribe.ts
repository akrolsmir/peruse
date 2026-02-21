import Replicate from "replicate";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ASRProvider {
  transcribe(audioUrl: string): Promise<TranscriptSegment[]>;
}

export class ReplicateASR implements ASRProvider {
  private client: Replicate;

  constructor() {
    this.client = new Replicate();
  }

  async transcribe(audioUrl: string): Promise<TranscriptSegment[]> {
    const output = await this.client.run("nvidia/canary-qwen-2.5b", {
      input: {
        audio: audioUrl,
      },
    });

    // The model returns segments with timestamps
    // Parse the output into our standard format
    return this.parseOutput(output);
  }

  private parseOutput(output: unknown): TranscriptSegment[] {
    // Handle different possible output formats from the model
    if (typeof output === "string") {
      // If it's a plain string, return as single segment
      return [{ start: 0, end: 0, text: output }];
    }

    if (Array.isArray(output)) {
      return output.map((seg) => {
        const s = seg as Record<string, unknown>;
        const ts = s.timestamp as number[] | undefined;
        return {
          start: Number(s.start ?? ts?.[0] ?? 0),
          end: Number(s.end ?? ts?.[1] ?? 0),
          text: String(s.text ?? s.transcript ?? ""),
        };
      });
    }

    // Handle object with segments/text property
    const obj = output as Record<string, unknown>;
    if (obj.segments && Array.isArray(obj.segments)) {
      return this.parseOutput(obj.segments);
    }
    if (obj.text) {
      return [{ start: 0, end: 0, text: String(obj.text) }];
    }

    return [{ start: 0, end: 0, text: JSON.stringify(output) }];
  }
}

export function createASR(): ASRProvider {
  return new ReplicateASR();
}
