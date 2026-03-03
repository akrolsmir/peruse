"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";

const FONT_KEY = "peruse-font";

const FONTS = [
  { id: "outfit", name: "Outfit", cssVar: "var(--font-outfit)" },
  { id: "geist", name: "Geist", cssVar: "var(--font-geist-sans)" },
  { id: "quicksand", name: "Quicksand", cssVar: "var(--font-quicksand)" },
  { id: "exo", name: "Exo", cssVar: "var(--font-exo)" },
] as const;

const THEMES = [
  { id: "light", name: "Light", icon: Sun },
  { id: "dark", name: "Dark", icon: Moon },
  { id: "system", name: "System", icon: Monitor },
] as const;

const SAMPLE =
  "The quick brown fox jumps over the lazy dog. Meanwhile, 1,234 podcast episodes were transcribed in just 56 minutes — not bad for a Tuesday afternoon.";

export default function ThemePage() {
  const [selectedFont, setSelectedFont] = useState("outfit");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(FONT_KEY);
    if (saved) setSelectedFont(saved);
  }, []);

  const applyFont = (id: string) => {
    setSelectedFont(id);
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
          <ArrowLeft size={14} />
          Back
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Theme
      </h1>
      <p className="mb-10 text-sm text-zinc-400">
        Customize the appearance of the app.
      </p>

      {/* Color mode */}
      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Color Mode
        </h2>
        <div className="flex gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = mounted && theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "border-amber-400 bg-amber-50/50 text-zinc-900 ring-1 ring-amber-400/30 dark:border-amber-500/60 dark:bg-amber-950/20 dark:text-zinc-100 dark:ring-amber-500/20"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <Icon size={16} />
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Typeface */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Typeface
        </h2>
        <div className="space-y-3">
          {FONTS.map((font) => (
            <button
              key={font.id}
              onClick={() => applyFont(font.id)}
              className={`group w-full rounded-xl border px-5 py-4 text-left transition-all ${
                selectedFont === font.id
                  ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-400/30 dark:border-amber-500/60 dark:bg-amber-950/20 dark:ring-amber-500/20"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <div className="mb-2 flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full border-2 transition-colors ${
                    selectedFont === font.id
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
      </section>
    </div>
  );
}
