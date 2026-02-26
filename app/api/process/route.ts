import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function POST(req: NextRequest) {
  const { episodeId, url, model, minSpeakers } = await req.json();
  const id = episodeId as Id<"episodes">;

  // If no URL provided, fetch it from the episode record
  let audioSource = url as string | undefined;
  if (!audioSource) {
    const episode = await getConvex().query(api.episodes.getById, { id });
    audioSource = episode?.audioUrl || episode?.url;
  }
  if (!audioSource) {
    return NextResponse.json({ error: "No audio URL" }, { status: 400 });
  }

  // Schedule the processing action in Convex
  await getConvex().mutation(api.episodes.startProcessing, {
    id,
    url: audioSource,
    model: model || "whisper",
    ...(minSpeakers ? { minSpeakers } : {}),
  });

  return NextResponse.json({ ok: true });
}
