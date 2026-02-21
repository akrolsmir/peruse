import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { postProcess } from "@/lib/postprocess";
import type { TranscriptSegment } from "@/lib/transcribe";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function POST(req: NextRequest) {
  const { episodeId } = await req.json();
  const id = episodeId as Id<"episodes">;

  reprocessPipeline(id).catch((err) => {
    console.error("Reprocess error:", err);
  });

  return NextResponse.json({ ok: true });
}

async function reprocessPipeline(id: Id<"episodes">) {
  try {
    const episode = await getConvex().query(api.episodes.getById, { id });
    if (!episode?.rawTranscript) {
      throw new Error("No raw transcript to reprocess");
    }

    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "processing",
    });

    const segments: TranscriptSegment[] = JSON.parse(episode.rawTranscript);

    await postProcess(segments, {
      async onChunkDone(paragraphs) {
        await getConvex().mutation(api.episodes.update, {
          id,
          transcript: JSON.stringify(paragraphs),
        });
      },
      async onSummaryDone(summary, chapters) {
        await getConvex().mutation(api.episodes.update, {
          id,
          summary,
          chapters: JSON.stringify(chapters),
          status: "done",
        });
      },
    });
  } catch (err) {
    console.error("Reprocess failed:", err);
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
