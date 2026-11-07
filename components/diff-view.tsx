"use client";

import { useQuery } from "convex/react";
import { diffArrays } from "diff";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { TranscriptSegment } from "@/lib/transcribe";
import type { Chapter, ProcessedParagraph } from "@/lib/postprocess";
import { formatTimestamp } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

type View = "raw" | "clean" | "summary" | "diff";
type Side = "a" | "b";

const VIEWS: { value: View; label: string }[] = [
  { value: "raw", label: "Raw ASR" },
  { value: "clean", label: "Cleaned transcript" },
  { value: "summary", label: "Summary & chapters" },
  { value: "diff", label: "Word diff" },
];

const MODEL_LABEL: Record<string, string> = {
  whisperx: "WhisperX large-v3",
  whisper: "Whisper large-v3",
  "canary-qwen": "Canary-Qwen 2.5B",
  "mai-transcribe-2": "MAI-Transcribe-2",
};

const SPEAKER_COLORS = [
  "text-violet-600 dark:text-violet-400",
  "text-orange-600 dark:text-orange-400",
  "text-cyan-700 dark:text-cyan-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-lime-700 dark:text-lime-400",
  "text-red-600 dark:text-red-400",
  "text-indigo-600 dark:text-indigo-400",
];

const SIDE_STYLE: Record<Side, { tag: string; border: string; label: string }> = {
  a: {
    tag: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    border: "border-t-amber-500",
    label: "A",
  },
  b: {
    tag: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    border: "border-t-teal-500",
    label: "B",
  },
};

// Verbatim models (MAI-Transcribe-2) keep every filler that Whisper drops, which
// swamps a raw diff. These are stripped when "ignore fillers" is on.
const FILLERS = new Set(["um", "uh", "umm", "uhh", "mm", "hmm", "mhm", "like"]);

function safeJson<T>(s: string | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function speakerIndex(label: string | undefined): number {
  const m = /(\d+)$/.exec(label ?? "");
  return m ? parseInt(m[1], 10) : 0;
}

function speakerColor(label: string | undefined): string {
  return SPEAKER_COLORS[speakerIndex(label) % SPEAKER_COLORS.length];
}

function parseTime(str: string): number | null {
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 0 || parts.some((n) => isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function tokenize(segments: TranscriptSegment[], dropFillers: boolean): string[] {
  const text = segments
    .map((s) => s.text)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ");
  const words = text.split(/\s+/).filter(Boolean);
  if (!dropFillers) return words;
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === "you" && words[i + 1] === "know") {
      i++;
      continue;
    }
    if (FILLERS.has(words[i])) continue;
    out.push(words[i]);
  }
  return out;
}

interface Shaped {
  ep: Doc<"episodes">;
  raw: TranscriptSegment[];
  paras: ProcessedParagraph[];
  chapters: Chapter[];
  words: number;
  speakers: [string, number][];
  duration: number;
}

function shape(ep: Doc<"episodes"> | null | undefined): Shaped | null {
  if (!ep) return null;
  const raw = safeJson<TranscriptSegment[]>(ep.rawTranscript, []);
  const paras = safeJson<ProcessedParagraph[]>(ep.transcript, []);
  const chapters = safeJson<Chapter[]>(ep.chapters, []);
  const counts = new Map<string, number>();
  let words = 0;
  for (const s of raw) {
    words += s.text.split(/\s+/).filter(Boolean).length;
    if (s.speaker) counts.set(s.speaker, (counts.get(s.speaker) ?? 0) + 1);
  }
  return {
    ep,
    raw,
    paras,
    chapters,
    words,
    speakers: [...counts.entries()].sort((x, y) => y[1] - x[1]),
    duration: raw.length ? raw[raw.length - 1].end : 0,
  };
}

export function DiffView() {
  const router = useRouter();
  const params = useSearchParams();
  const slugA = params.get("a") ?? "";
  const slugB = params.get("b") ?? "";
  const view = (params.get("view") as View | null) ?? "raw";

  const episodes = useQuery(api.episodes.list);
  const epA = useQuery(api.episodes.getBySlug, slugA ? { slug: slugA } : "skip");
  const epB = useQuery(api.episodes.getBySlug, slugB ? { slug: slugB } : "skip");
  const a = useMemo(() => shape(epA), [epA]);
  const b = useMemo(() => shape(epB), [epB]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`/diff?${next.toString()}`);
    },
    [params, router],
  );

  const [syncScroll, setSyncScroll] = useState(true);
  const [ignoreFillers, setIgnoreFillers] = useState(true);
  const [jump, setJump] = useState("");
  const [highlight, setHighlight] = useState<number | null>(null);
  const scrollA = useRef<HTMLDivElement>(null);
  const scrollB = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const topTime = (el: HTMLDivElement): number | null => {
    const top = el.scrollTop + 8;
    for (const node of el.querySelectorAll<HTMLElement>("[data-t]")) {
      if (node.offsetTop + node.offsetHeight >= top) return parseFloat(node.dataset.t!);
    }
    return null;
  };

  const scrollToTime = (el: HTMLDivElement | null, t: number) => {
    if (!el) return;
    const nodes = el.querySelectorAll<HTMLElement>("[data-t]");
    let target: HTMLElement | null = null;
    for (const node of nodes) {
      if (parseFloat(node.dataset.t!) >= t) {
        target = node;
        break;
      }
    }
    if (!target && nodes.length) target = nodes[nodes.length - 1];
    if (target) el.scrollTop = target.offsetTop - 8;
  };

  const onScroll = (from: Side) => () => {
    if (!syncScroll || syncing.current) return;
    const src = from === "a" ? scrollA.current : scrollB.current;
    const dst = from === "a" ? scrollB.current : scrollA.current;
    if (!src || !dst) return;
    const t = topTime(src);
    if (t == null) return;
    syncing.current = true;
    scrollToTime(dst, t);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const onJump = () => {
    const t = parseTime(jump);
    if (t == null) return;
    syncing.current = true;
    scrollToTime(scrollA.current, t);
    scrollToTime(scrollB.current, t);
    setHighlight(t);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  // Scroll positions are lost when the view changes, so re-apply the last jump.
  useEffect(() => {
    if (highlight == null) return;
    const id = requestAnimationFrame(() => {
      scrollToTime(scrollA.current, highlight);
      scrollToTime(scrollB.current, highlight);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const picker = (side: Side) => {
    const value = side === "a" ? slugA : slugB;
    return (
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wider ${SIDE_STYLE[side].tag}`}
        >
          {SIDE_STYLE[side].label}
        </span>
        <select
          value={value}
          onChange={(e) => setParam(side, e.target.value)}
          className="min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Choose an episode…</option>
          {(episodes ?? []).map((ep) => (
            <option key={ep._id} value={ep.slug}>
              {ep.title}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {picker("a")}
        {picker("b")}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatCard side="a" shaped={a} slug={slugA} loading={epA === undefined && !!slugA} />
        <StatCard side="b" shaped={b} slug={slugB} loading={epB === undefined && !!slugB} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              onClick={() => setParam("view", v.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                view === v.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {(view === "raw" || view === "clean") && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Jump to
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onJump()}
                onBlur={onJump}
                placeholder="mm:ss"
                className="w-16 rounded-md border border-zinc-200 bg-white px-1.5 py-1 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
              />
              sync scroll
            </label>
          </>
        )}
        {view === "diff" && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={ignoreFillers}
              onChange={(e) => setIgnoreFillers(e.target.checked)}
            />
            ignore fillers (um, uh, like, you know)
          </label>
        )}
      </div>

      {view === "diff" ? (
        <WordDiff a={a} b={b} ignoreFillers={ignoreFillers} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Column
            side="a"
            shaped={a}
            view={view}
            scrollRef={scrollA}
            onScroll={onScroll("a")}
            highlight={highlight}
          />
          <Column
            side="b"
            shaped={b}
            view={view}
            scrollRef={scrollB}
            onScroll={onScroll("b")}
            highlight={highlight}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  side,
  shaped,
  slug,
  loading,
}: {
  side: Side;
  shaped: Shaped | null;
  slug: string;
  loading: boolean;
}) {
  const base = `rounded-xl border border-zinc-200 border-t-[3px] bg-white px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900 ${SIDE_STYLE[side].border}`;
  if (!slug)
    return (
      <div className={`${base} text-zinc-400`}>
        Pick an episode for side {SIDE_STYLE[side].label}.
      </div>
    );
  if (loading) return <div className={`${base} text-zinc-400`}>Loading…</div>;
  if (!shaped) return <div className={`${base} text-zinc-400`}>No episode with that slug.</div>;
  const { ep } = shaped;
  const row = (k: string, v: React.ReactNode) => (
    <>
      <dt className="text-zinc-400">{k}</dt>
      <dd className="min-w-0 tabular-nums text-zinc-700 dark:text-zinc-200">{v}</dd>
    </>
  );
  return (
    <div className={base}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {MODEL_LABEL[ep.model ?? ""] ?? ep.model ?? "unknown model"}
        </span>
        <StatusBadge status={ep.status} />
        {ep.minSpeakers ? (
          <span className="text-zinc-400">min speakers {ep.minSpeakers}</span>
        ) : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {row("Audio", formatTimestamp(shaped.duration))}
        {row("Raw segments", shaped.raw.length)}
        {row("Raw words", shaped.words.toLocaleString())}
        {row("Paragraphs", shaped.paras.length)}
        {row(
          "Speakers",
          shaped.speakers.length ? (
            <span className="flex flex-wrap gap-x-3 gap-y-0.5">
              {shaped.speakers.map(([label, n]) => (
                <span key={label} className={`font-mono ${speakerColor(label)}`}>
                  {label} <span className="text-zinc-400">{n}</span>
                </span>
              ))}
            </span>
          ) : (
            "none"
          ),
        )}
        {row(
          "Names",
          ep.speakerNames?.length ? (
            <span className="flex flex-wrap gap-x-3">
              {ep.speakerNames.map((n, i) => (
                <span key={i} className={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}>
                  {n}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-zinc-400">not yet</span>
          ),
        )}
        {ep.error ? row("Error", <span className="text-red-600">{ep.error}</span>) : null}
      </dl>
    </div>
  );
}

function Column({
  side,
  shaped,
  view,
  scrollRef,
  onScroll,
  highlight,
}: {
  side: Side;
  shaped: Shaped | null;
  view: View;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  highlight: number | null;
}) {
  const title = side === "a" ? "A" : "B";
  const model = shaped ? (MODEL_LABEL[shaped.ep.model ?? ""] ?? shaped.ep.model) : "";
  let meta = "";
  let body: React.ReactNode;

  if (!shaped) {
    body = <p className="px-4 py-6 text-sm text-zinc-400">Nothing loaded.</p>;
  } else if (view === "raw") {
    meta = `${shaped.raw.length} segments`;
    body = shaped.raw.length ? (
      shaped.raw.map((s, i) => (
        <Row
          key={i}
          start={s.start}
          speaker={s.speaker}
          text={s.text}
          active={highlight != null && highlight >= s.start && highlight < s.end}
        />
      ))
    ) : (
      <p className="px-4 py-6 text-sm text-zinc-400">No raw transcript yet.</p>
    );
  } else if (view === "clean") {
    meta = `${shaped.paras.length} paragraphs`;
    const names = shaped.ep.speakerNames ?? [];
    body = shaped.paras.length ? (
      shaped.paras.map((p, i) => (
        <Row
          key={i}
          start={p.start}
          speaker={p.speaker}
          speakerName={p.speaker ? names[speakerIndex(p.speaker)] : undefined}
          text={p.text}
          prose
          active={highlight != null && highlight >= p.start && highlight < p.end}
        />
      ))
    ) : (
      <p className="px-4 py-6 text-sm text-zinc-400">
        {shaped.ep.status === "done"
          ? "No cleaned transcript."
          : "Claude post-processing is still running. This page updates live."}
      </p>
    );
  } else {
    meta = `${shaped.chapters.length} chapters`;
    const names = shaped.ep.speakerNames ?? [];
    body = (
      <div className="max-w-prose space-y-5 px-4 py-4 text-sm">
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Summary
          </h3>
          <p className="whitespace-pre-line leading-relaxed text-zinc-700 dark:text-zinc-200">
            {shaped.ep.summary ?? <span className="text-zinc-400">Not generated yet.</span>}
          </p>
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Chapters
          </h3>
          {shaped.chapters.length ? (
            <ol className="space-y-1">
              {shaped.chapters.map((c, i) => (
                <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-amber-600 dark:text-amber-400">
                    {formatTimestamp(c.timestamp)}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-200">{c.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-zinc-400">None yet.</span>
          )}
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Speaker names
          </h3>
          {names.length ? (
            <ul className="space-y-0.5 font-mono text-xs">
              {names.map((n, i) => (
                <li key={i} className={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}>
                  SPEAKER_{String(i).padStart(2, "0")} → {n}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-zinc-400">None yet.</span>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        <span>
          <span className={`mr-1.5 rounded px-1.5 py-0.5 font-semibold ${SIDE_STYLE[side].tag}`}>
            {title}
          </span>
          {model}
        </span>
        <span>{meta}</span>
      </header>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="max-h-[calc(100vh-22rem)] min-h-72 overflow-y-auto overscroll-contain py-1"
      >
        {body}
      </div>
    </div>
  );
}

function Row({
  start,
  speaker,
  speakerName,
  text,
  prose,
  active,
}: {
  start: number;
  speaker?: string;
  speakerName?: string;
  text: string;
  prose?: boolean;
  active: boolean;
}) {
  return (
    <div
      data-t={start}
      className={`grid grid-cols-[3.5rem_1fr] gap-x-2 border-l-2 px-3 py-1 ${
        active ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"
      } hover:bg-zinc-50 dark:hover:bg-zinc-800/50`}
    >
      <span className="pt-0.5 font-mono text-[11px] tabular-nums text-zinc-400">
        {formatTimestamp(start)}
      </span>
      <div className={`min-w-0 ${prose ? "max-w-prose" : ""}`}>
        {speaker && (
          <div className={`font-mono text-[11px] ${speakerColor(speaker)}`} title={speaker}>
            {speakerName ?? speaker}
          </div>
        )}
        <div
          className={`${prose ? "text-sm leading-relaxed text-zinc-800 dark:text-zinc-100" : "font-mono text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300"} break-words`}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function WordDiff({
  a,
  b,
  ignoreFillers,
}: {
  a: Shaped | null;
  b: Shaped | null;
  ignoreFillers: boolean;
}) {
  const result = useMemo(() => {
    if (!a?.raw.length || !b?.raw.length) return null;
    const wa = tokenize(a.raw, ignoreFillers);
    const wb = tokenize(b.raw, ignoreFillers);
    const parts = diffArrays(wa, wb);
    let onlyA = 0;
    let onlyB = 0;
    for (const p of parts) {
      if (p.added) onlyB += p.value.length;
      else if (p.removed) onlyA += p.value.length;
    }
    return { parts, countA: wa.length, countB: wb.length, onlyA, onlyB };
  }, [a, b, ignoreFillers]);

  if (!result) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
        Both raw transcripts are needed for a diff.
      </p>
    );
  }

  const pct = ((100 * Math.max(result.onlyA, result.onlyB)) / Math.max(result.countA, 1)).toFixed(
    1,
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm leading-loose break-words dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>
          <del className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            only in A
          </del>
        </span>
        <span>
          <ins className="rounded bg-teal-100 px-1 text-teal-800 no-underline dark:bg-teal-950 dark:text-teal-300">
            only in B
          </ins>
        </span>
        <span className="tabular-nums">
          A {result.countA.toLocaleString()} words · B {result.countB.toLocaleString()} words ·{" "}
          {pct}% differ{ignoreFillers ? " after dropping fillers" : ""}
        </span>
        <span>Lowercased, punctuation removed, long identical runs collapsed.</span>
      </div>
      {result.parts.map((p, i) => {
        const words = p.value;
        if (p.added)
          return (
            <ins
              key={i}
              className="rounded bg-teal-100 px-0.5 font-medium text-teal-800 no-underline dark:bg-teal-950 dark:text-teal-300"
            >
              {words.join(" ")}{" "}
            </ins>
          );
        if (p.removed)
          return (
            <del
              key={i}
              className="rounded bg-amber-100 px-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              {words.join(" ")}{" "}
            </del>
          );
        if (words.length > 14)
          return (
            <span key={i} className="text-zinc-400">
              {words.slice(0, 6).join(" ")}
              <span className="my-1 block text-center font-mono text-[11px]">
                … {words.length - 12} identical words …
              </span>
              {words.slice(-6).join(" ")}{" "}
            </span>
          );
        return (
          <span key={i} className="text-zinc-400">
            {words.join(" ")}{" "}
          </span>
        );
      })}
    </div>
  );
}
