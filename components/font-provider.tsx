"use client";

import { useEffect } from "react";

const FONT_KEY = "peruse-font";

const FONT_MAP: Record<string, string> = {
  geist: "var(--font-geist-sans)",
  quicksand: "var(--font-quicksand)",
  exo: "var(--font-exo)",
  outfit: "var(--font-outfit)",
};

export function FontProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(FONT_KEY);
    if (saved && FONT_MAP[saved]) {
      document.documentElement.style.setProperty("--font-sans", FONT_MAP[saved]);
      document.body.style.fontFamily = `${FONT_MAP[saved]}, system-ui, sans-serif`;
    }
  }, []);

  return <>{children}</>;
}
