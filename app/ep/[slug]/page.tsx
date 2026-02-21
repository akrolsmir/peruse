"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";

const EpisodeDetail = dynamic(
  () => import("@/components/episode-detail").then((m) => m.EpisodeDetail),
  {
    ssr: false,
    loading: () => <p className="text-sm text-zinc-500">Loading...</p>,
  }
);

export default function EpisodePage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        &larr; Back
      </Link>
      <EpisodeDetail slug={slug} />
    </div>
  );
}
