import { DatabaseReader } from "./_generated/server";
import { slugify } from "../lib/slugify";

export async function uniqueSlug(
  db: DatabaseReader,
  table: "episodes" | "feeds",
  text: string,
): Promise<string> {
  const base = slugify(text);
  const existing = await db
    .query(table)
    .withIndex("by_slug", (q) => q.eq("slug", base))
    .first();
  if (!existing) return base;

  // Find a unique suffix
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    const taken = await db
      .query(table)
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!taken) return candidate;
  }

  // Fallback: append timestamp
  return `${base}-${Date.now().toString(36)}`;
}
