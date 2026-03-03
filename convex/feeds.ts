import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { uniqueSlug } from "./slugs";

const feedEpisodeValidator = v.object({
  guid: v.string(),
  title: v.string(),
  description: v.string(),
  audioUrl: v.string(),
  imageUrl: v.optional(v.string()),
  pubDate: v.string(),
  duration: v.string(),
});

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

export const listItems = query({
  args: { feedId: v.id("feeds") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("feedItems")
      .withIndex("by_feedId", (q) => q.eq("feedId", args.feedId))
      .collect();
  },
});

export const create = mutation({
  args: {
    feedUrl: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    episodes: v.array(feedEpisodeValidator),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueSlug(ctx.db, "feeds", args.title);
    const now = Date.now();
    const id = await ctx.db.insert("feeds", {
      feedUrl: args.feedUrl,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      slug,
      episodeCount: args.episodes.length,
      lastFetchedAt: now,
      createdAt: now,
    });

    for (const ep of args.episodes) {
      await ctx.db.insert("feedItems", { feedId: id, ...ep });
    }

    return { id, slug };
  },
});

export const refreshItems = mutation({
  args: {
    id: v.id("feeds"),
    episodes: v.array(feedEpisodeValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feedItems")
      .withIndex("by_feedId", (q) => q.eq("feedId", args.id))
      .collect();
    const existingByGuid = new Map(existing.map((item) => [item.guid, item]));

    for (const ep of args.episodes) {
      const match = existingByGuid.get(ep.guid);
      if (match) {
        await ctx.db.patch(match._id, {
          title: ep.title,
          description: ep.description,
          audioUrl: ep.audioUrl,
          imageUrl: ep.imageUrl,
          pubDate: ep.pubDate,
          duration: ep.duration,
        });
        existingByGuid.delete(ep.guid);
      } else {
        await ctx.db.insert("feedItems", { feedId: args.id, ...ep });
      }
    }

    // Recount — we don't delete old items (feeds may truncate their RSS)
    const allItems = await ctx.db
      .query("feedItems")
      .withIndex("by_feedId", (q) => q.eq("feedId", args.id))
      .collect();

    await ctx.db.patch(args.id, {
      episodeCount: allItems.length,
      lastFetchedAt: Date.now(),
    });
  },
});
