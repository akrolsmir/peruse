"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { slugify } from "@/lib/slugify";
import type { ASRModel } from "@/lib/transcribe";

const models: { value: ASRModel; label: string; description: string }[] = [
  {
    value: "whisper",
    label: "Whisper Large v3",
    description: "Fast, reliable, handles long files well",
  },
  {
    value: "canary-qwen",
    label: "Canary-Qwen 2.5B",
    description: "Lower word error rate, may struggle with long files",
  },
  {
    value: "whisperx",
    label: "WhisperX Large v3",
    description: "Word-level timestamps with speaker diarization",
  },
];

export function UploadForm() {
  const router = useRouter();
  const createEpisode = useMutation(api.episodes.create);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [model, setModel] = useState<ASRModel>("whisper");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const episodeTitle =
        title.trim() || new URL(url).pathname.split("/").pop() || "Untitled Episode";
      const slug = slugify(episodeTitle) + "-" + Date.now().toString(36);

      const episodeId = await createEpisode({
        title: episodeTitle,
        url: url.trim(),
        slug,
      });

      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, url: url.trim(), model }),
      });

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="title"
          className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400"
        >
          Title (optional)
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Episode title"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      <div>
        <label
          htmlFor="url"
          className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-400"
        >
          Audio URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/episode.mp3"
          required
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      <fieldset>
        <legend className="mb-3 block text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Transcription Model
        </legend>
        <div className="space-y-2">
          {models.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                model === m.value
                  ? "border-amber-500 bg-amber-50/50 dark:border-amber-500/50 dark:bg-amber-950/20"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  model === m.value ? "border-amber-500" : "border-zinc-300 dark:border-zinc-600"
                }`}
              >
                {model === m.value && <div className="h-2 w-2 rounded-full bg-amber-500" />}
              </div>
              <input
                type="radio"
                name="model"
                value={m.value}
                checked={model === m.value}
                onChange={() => setModel(m.value)}
                className="sr-only"
              />
              <div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {m.label}
                </span>
                <p className="mt-0.5 text-xs text-zinc-400">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Processing...
          </span>
        ) : (
          "Start Transcription"
        )}
      </button>
    </form>
  );
}
