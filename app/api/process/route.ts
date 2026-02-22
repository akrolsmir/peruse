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

  // If no URL provided, fetch it from the episode record
  let audioSource = url as string | undefined;
  if (!audioSource) {
    const episode = await getConvex().query(api.episodes.getById, { id });
    audioSource = episode?.audioUrl || episode?.url;
  }
  if (!audioSource) {
    return NextResponse.json({ error: "No audio URL" }, { status: 400 });
  }

  processPipeline(id, audioSource, asrModel).catch((err) => {
    console.error("Pipeline error:", err);
  });

  return NextResponse.json({ ok: true });
}

async function processPipeline(id: Id<"episodes">, url: string, model: ASRModel) {
  try {
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "downloading",
    });

    // Skip validation for Convex storage URLs — they're already direct links
    const isConvexUrl = url.includes(".convex.cloud/");
    const audioUrl = isConvexUrl ? url : await validateAudioUrl(url);
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "downloading",
      audioUrl,
    });

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

    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "processing",
    });

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
    console.error("Pipeline failed:", err);
    await getConvex().mutation(api.episodes.updateStatus, {
      id,
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
