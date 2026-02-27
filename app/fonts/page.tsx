"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const FONT_KEY = "peruse-font";

const FONTS = [
  { id: "outfit", name: "Outfit", cssVar: "var(--font-outfit)" },
  { id: "geist", name: "Geist", cssVar: "var(--font-geist-sans)" },
  { id: "quicksand", name: "Quicksand", cssVar: "var(--font-quicksand)" },
  { id: "exo", name: "Exo", cssVar: "var(--font-exo)" },
] as const;

const SAMPLE =
  "The quick brown fox jumps over the lazy dog. Meanwhile, 1,234 podcast episodes were transcribed in just 56 minutes — not bad for a Tuesday afternoon.";

export default function FontPage() {
  const [selected, setSelected] = useState("outfit");

  useEffect(() => {
    const saved = localStorage.getItem(FONT_KEY);
    if (saved) setSelected(saved);
  }, []);

  const apply = (id: string) => {
    setSelected(id);
    const font = FONTS.find((f) => f.id === id);
    if (!font) return;
    localStorage.setItem(FONT_KEY, id);
    document.documentElement.style.setProperty("--font-sans", font.cssVar);
    document.body.style.fontFamily = `${font.cssVar}, system-ui, sans-serif`;
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Fonts
      </h1>
      <p className="mb-10 text-sm text-zinc-400">
        Choose the sans-serif typeface used across the app.
      </p>

      <div className="space-y-3">
        {FONTS.map((font) => (
          <button
            key={font.id}
            onClick={() => apply(font.id)}
            className={`group w-full rounded-xl border px-5 py-4 text-left transition-all ${
              selected === font.id
                ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-400/30 dark:border-amber-500/60 dark:bg-amber-950/20 dark:ring-amber-500/20"
                : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
            }`}
          >
            <div className="mb-2 flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  selected === font.id
                    ? "border-amber-500 bg-amber-500"
                    : "border-zinc-300 dark:border-zinc-600"
                }`}
              />
              <span
                className="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
                style={{ fontFamily: `${font.cssVar}, system-ui, sans-serif` }}
              >
                {font.name}
              </span>
              {font.id === "outfit" && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800">
                  default
                </span>
              )}
            </div>
            <p
              className="text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400"
              style={{ fontFamily: `${font.cssVar}, system-ui, sans-serif` }}
            >
              {SAMPLE}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
