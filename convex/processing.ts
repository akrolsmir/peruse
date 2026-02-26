"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { validateAudioUrl } from "../lib/audio";
import { createASR, type ASRModel, type TranscriptSegment } from "../lib/transcribe";
import { postProcess } from "../lib/postprocess";

export const processEpisode = internalAction({
  args: {
    id: v.id("episodes"),
    url: v.string(),
    model: v.string(),
    minSpeakers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, url, model, minSpeakers } = args;
    const asrModel = (model || "whisper") as ASRModel;

    try {
      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "downloading",
      });

      // Skip validation for Convex storage URLs — they're already direct links
      const isConvexUrl = url.includes(".convex.cloud/");
      const audioUrl = isConvexUrl ? url : await validateAudioUrl(url);
      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "downloading",
        audioUrl,
      });

      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "transcribing",
      });

      const asr = createASR(asrModel);
      const segments = await asr.transcribe(audioUrl, { minSpeakers });
      const rawTranscript = JSON.stringify(segments);

      await ctx.runMutation(api.episodes.update, {
        id,
        rawTranscript,
      });

      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "processing",
      });

      const episode = await ctx.runQuery(api.episodes.getById, { id });
      let feedDescription: string | undefined;
      if (episode?.feedId) {
        const feed = await ctx.runQuery(api.feeds.getById, {
          id: episode.feedId,
        });
        feedDescription = feed?.description ?? undefined;
      }

      await postProcess(
        segments,
        {
          async onChunkDone(paragraphs) {
            await ctx.runMutation(api.episodes.update, {
              id,
              transcript: JSON.stringify(paragraphs),
            });
          },
          async onSummaryDone(summary, chapters, speakerNames) {
            await ctx.runMutation(api.episodes.update, {
              id,
              summary,
              chapters: JSON.stringify(chapters),
              status: "done",
              ...(speakerNames.length > 0 ? { speakerNames } : {}),
            });
          },
        },
        {
          title: episode?.title,
          description: episode?.description,
          feedDescription,
        },
      );
    } catch (err) {
      console.error("Pipeline failed:", err);
      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});

export const reprocessEpisode = internalAction({
  args: {
    id: v.id("episodes"),
  },
  handler: async (ctx, args) => {
    const { id } = args;

    try {
      const episode = await ctx.runQuery(api.episodes.getById, { id });
      if (!episode?.rawTranscript) {
        throw new Error("No raw transcript to reprocess");
      }

      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "processing",
      });

      const segments: TranscriptSegment[] = JSON.parse(episode.rawTranscript);

      let feedDescription: string | undefined;
      if (episode.feedId) {
        const feed = await ctx.runQuery(api.feeds.getById, {
          id: episode.feedId,
        });
        feedDescription = feed?.description ?? undefined;
      }

      await postProcess(
        segments,
        {
          async onChunkDone(paragraphs) {
            await ctx.runMutation(api.episodes.update, {
              id,
              transcript: JSON.stringify(paragraphs),
            });
          },
          async onSummaryDone(summary, chapters, speakerNames) {
            await ctx.runMutation(api.episodes.update, {
              id,
              summary,
              chapters: JSON.stringify(chapters),
              status: "done",
              ...(speakerNames.length > 0 ? { speakerNames } : {}),
            });
          },
        },
        {
          title: episode.title,
          description: episode.description,
          feedDescription,
        },
      );
    } catch (err) {
      console.error("Reprocess failed:", err);
      await ctx.runMutation(api.episodes.updateStatus, {
        id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});
