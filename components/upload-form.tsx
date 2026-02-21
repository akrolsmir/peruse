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
        title.trim() ||
        new URL(url).pathname.split("/").pop() ||
        "Untitled Episode";
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Title (optional)
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Episode title"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="url"
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Podcast Audio URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/episode.mp3"
          required
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Transcription Model
        </legend>
        <div className="space-y-2">
          {models.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                model === m.value
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m.value}
                checked={model === m.value}
                onChange={() => setModel(m.value)}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {m.label}
                </span>
                <p className="text-xs text-zinc-500">{m.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Processing..." : "Start Transcription"}
      </button>
    </form>
  );
}
