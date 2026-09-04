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
  kind: v.optional(v.union(v.literal("audio"), v.literal("article"))),
  link: v.optional(v.string()),
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

// Slim projection: descriptions (show notes) can be several KB each and
// aren't needed for the list. Fetch them per-item with getItem instead.
export const listItems = query({
  args: { feedId: v.id("feeds") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("feedItems")
      .withIndex("by_feedId", (q) => q.eq("feedId", args.feedId))
      .collect();
    return items.map((item) => ({
      _id: item._id,
      guid: item.guid,
      title: item.title,
      audioUrl: item.audioUrl,
      imageUrl: item.imageUrl,
      pubDate: item.pubDate,
      duration: item.duration,
      kind: item.kind,
      link: item.link,
    }));
  },
});

export const getItem = query({
  args: { id: v.id("feedItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    feedUrl: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // The client may have resolved a site URL to its feed URL, so a feed can
    // already exist even if the form's pre-check on the typed URL found nothing.
    const existing = await ctx.db
      .query("feeds")
      .withIndex("by_feedUrl", (q) => q.eq("feedUrl", args.feedUrl))
      .first();
    if (existing) return { id: existing._id, slug: existing.slug };

    const slug = await uniqueSlug(ctx.db, "feeds", args.title);
    const now = Date.now();
    const id = await ctx.db.insert("feeds", {
      feedUrl: args.feedUrl,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      slug,
      episodeCount: 0,
      lastFetchedAt: now,
      createdAt: now,
    });
    return { id, slug };
  },
});

// Upserts one batch of items by guid. Callers split large feeds into batches
// (see lib/feed.ts) so no single mutation approaches Convex's per-transaction
// limits, and existing items are looked up via index rather than loaded in full.
// episodeCount is tracked incrementally so we never have to count all items.
export const upsertItems = mutation({
  args: {
    id: v.id("feeds"),
    episodes: v.array(feedEpisodeValidator),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const ep of args.episodes) {
      const match = await ctx.db
        .query("feedItems")
        .withIndex("by_feedId_guid", (q) => q.eq("feedId", args.id).eq("guid", ep.guid))
        .first();
      if (match) {
        await ctx.db.patch(match._id, {
          title: ep.title,
          description: ep.description,
          audioUrl: ep.audioUrl,
          imageUrl: ep.imageUrl,
          pubDate: ep.pubDate,
          duration: ep.duration,
          kind: ep.kind,
          link: ep.link,
        });
      } else {
        await ctx.db.insert("feedItems", { feedId: args.id, ...ep });
        // episodeCount only tracks transcribable items; articles are counted client-side.
        if (ep.kind !== "article") inserted++;
      }
    }

    // We never delete old items (feeds may truncate their RSS), so the count only grows.
    const feed = await ctx.db.get(args.id);
    if (!feed) throw new Error("Feed not found");
    await ctx.db.patch(args.id, {
      episodeCount: feed.episodeCount + inserted,
      lastFetchedAt: Date.now(),
    });
    return { inserted };
  },
});
