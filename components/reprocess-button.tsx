"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function ReprocessButton({ episodeId }: { episodeId: string }) {
  const cloneEpisode = useMutation(api.episodes.clone);
  const [reprocessing, setReprocessing] = useState(false);

  const handleReprocess = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReprocessing(true);
    try {
      const { id } = await cloneEpisode({ id: episodeId as never });
      await fetch("/api/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: id }),
      });
    } catch (err) {
      console.error("Reprocess failed:", err);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <button
      onClick={handleReprocess}
      disabled={reprocessing}
      className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
    >
      {reprocessing ? "Cloning..." : "Reprocess"}
    </button>
  );
}
