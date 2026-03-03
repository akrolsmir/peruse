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
    description: v.optional(v.string()),
    feedId: v.optional(v.id("feeds")),
    imageUrl: v.optional(v.string()),
    pubDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_feedId", ["feedId"]),

  feeds: defineTable({
    feedUrl: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    slug: v.string(),
    episodeCount: v.number(),
    lastFetchedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_feedUrl", ["feedUrl"]),

  feedItems: defineTable({
    feedId: v.id("feeds"),
    guid: v.string(),
    title: v.string(),
    description: v.string(),
    audioUrl: v.string(),
    imageUrl: v.optional(v.string()),
    pubDate: v.string(),
    duration: v.string(),
  }).index("by_feedId", ["feedId"]),
});
