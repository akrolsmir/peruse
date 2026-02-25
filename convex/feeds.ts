import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { uniqueSlug } from "./slugs";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("feeds").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("feeds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listRecent = query({
  handler: async (ctx) => {
    return await ctx.db.query("feeds").order("desc").take(5);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feeds")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getByFeedUrl = query({
  args: { feedUrl: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feeds")
      .withIndex("by_feedUrl", (q) => q.eq("feedUrl", args.feedUrl))
      .first();
  },
});

export const create = mutation({
  args: {
    feedUrl: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    episodes: v.string(),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueSlug(ctx.db, "feeds", args.title);
    const now = Date.now();
    const id = await ctx.db.insert("feeds", {
      ...args,
      slug,
      lastFetchedAt: now,
      createdAt: now,
    });
    return { id, slug };
  },
});

export const updateEpisodes = mutation({
  args: {
    id: v.id("feeds"),
    episodes: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      episodes: args.episodes,
      lastFetchedAt: Date.now(),
    });
  },
});
