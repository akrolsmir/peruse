import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  episodes: defineTable({
    title: v.string(),
    url: v.string(),
    audioUrl: v.optional(v.string()),
    slug: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("downloading"),
      v.literal("transcribing"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
    rawTranscript: v.optional(v.string()),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    chapters: v.optional(v.string()),
    speakerNames: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),
});
