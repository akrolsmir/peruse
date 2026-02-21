import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("episodes").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("episodes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("episodes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    url: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("episodes", {
      title: args.title,
      url: args.url,
      slug: args.slug,
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("episodes"),
    status: v.union(
      v.literal("pending"),
      v.literal("downloading"),
      v.literal("transcribing"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const update: Record<string, unknown> = { status: fields.status };
    if (fields.error !== undefined) update.error = fields.error;
    if (fields.audioUrl !== undefined) update.audioUrl = fields.audioUrl;
    await ctx.db.patch(id, update);
  },
});

export const clone = mutation({
  args: { id: v.id("episodes") },
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.id);
    if (!episode) throw new Error("Episode not found");
    const slug = episode.slug + "-re-" + Date.now().toString(36);
    const newId = await ctx.db.insert("episodes", {
      title: episode.title,
      url: episode.url,
      audioUrl: episode.audioUrl,
      slug,
      status: "processing",
      rawTranscript: episode.rawTranscript,
      createdAt: Date.now(),
    });
    return { id: newId, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("episodes"),
    rawTranscript: v.optional(v.string()),
    transcript: v.optional(v.string()),
    summary: v.optional(v.string()),
    chapters: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("downloading"),
        v.literal("transcribing"),
        v.literal("processing"),
        v.literal("done"),
        v.literal("error")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) update[key] = value;
    }
    await ctx.db.patch(id, update);
  },
});
