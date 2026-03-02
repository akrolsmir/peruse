"use client";

import { useEffect, useRef, useState } from "react";

interface Chapter {
  title: string;
  timestamp: number;
}

interface ChapterNavProps {
  chapters: Chapter[];
  onSeek: (time: number) => void;
}

export function ChapterNav({ chapters, onSeek }: ChapterNavProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const elements = chapters.map((_, i) => document.getElementById(`chapter-${i}`));
    if (elements.every((el) => el === null)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = visible[0].target.id;
          const idx = parseInt(id.replace("chapter-", ""), 10);
          if (!isNaN(idx)) setActiveIndex(idx);
        }
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );

    for (const el of elements) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapters]);

  // Auto-scroll active chapter into view within the sidebar
  useEffect(() => {
    const item = itemRefs.current[activeIndex];
    if (item && listRef.current) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  const handleClick = (index: number, timestamp: number) => {
    const el = document.getElementById(`chapter-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onSeek(timestamp);
  };

  return (
    <nav className="hidden lg:block">
      <div className="sticky top-10 border-l border-zinc-200 p-4 dark:border-zinc-800/50">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
          Chapters
        </div>
        <div className="mt-3">
          <ul
            ref={listRef}
            className="scrollbar-none max-h-[calc(100vh-12rem)] space-y-0.5 overflow-y-auto pb-4"
          >
            {chapters.map((ch, i) => (
              <li key={i} ref={(el) => { itemRefs.current[i] = el; }}>
                <button
                  onClick={() => handleClick(i, ch.timestamp)}
                  className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                    activeIndex === i
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                      : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-300"
                  }`}
                >
                  <span className="flex-1">{ch.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
