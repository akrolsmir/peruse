import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { validateAudioUrl } from "@/lib/audio";
import { createASR, type ASRModel } from "@/lib/transcribe";
import { postProcess } from "@/lib/postprocess";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function POST(req: NextRequest) {
  const { episodeId, url, model } = await req.json();
  const id = episodeId as Id<"episodes">;
  const asrModel = (model || "whisper") as ASRModel;

  // Run pipeline in background — don't await the full thing
  // so the client gets an immediate response
  processPipeline(id, url, asrModel).catch((err) => {
    console.error("Pipeline error:", err);
  });

  return NextResponse.json({ ok: true });
}

async function processPipeline(id: Id<"episodes">, url: string, model: ASRModel) {
  try {
    // Step 1: Validate audio URL
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "downloading",
    });

    const audioUrl = await validateAudioUrl(url);
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "downloading",
      audioUrl,
    });

    // Step 2: Transcribe
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "transcribing",
    });

    const asr = createASR(model);
    const segments = await asr.transcribe(audioUrl);
    const rawTranscript = JSON.stringify(segments);

    await getConvex().mutation(api.episodes.update, {
      id,
      rawTranscript,
    });

    // Step 3: Post-process with Claude
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "processing",
    });

    const result = await postProcess(segments);

    // Step 4: Store results
    await getConvex().mutation(api.episodes.update, {
      id,
      transcript: JSON.stringify(result.paragraphs),
      summary: result.summary,
      chapters: JSON.stringify(result.chapters),
      status: "done",
    });
  } catch (err) {
    console.error("Pipeline failed:", err);
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
