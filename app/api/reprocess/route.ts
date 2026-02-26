import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function POST(req: NextRequest) {
  const { episodeId } = await req.json();
  const id = episodeId as Id<"episodes">;

  // Schedule the reprocessing action in Convex
  await getConvex().mutation(api.episodes.startReprocessing, { id });

  return NextResponse.json({ ok: true });
}
