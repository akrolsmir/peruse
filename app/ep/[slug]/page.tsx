"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";

const EpisodeDetail = dynamic(
  () => import("@/components/episode-detail").then((m) => m.EpisodeDetail),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-24">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    ),
  },
);

export default function EpisodePage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen overflow-x-hidden pb-24">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EpisodeDetail slug={slug} />
      </div>
    </div>
  );
}
