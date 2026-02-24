import Link from "next/link";
import { StatusBadge } from "./status-badge";

interface Episode {
  _id: string;
  title: string;
  slug: string;
  status: string;
  hasRawTranscript: boolean;
  createdAt: number;
}

export function EpisodeCard({ episode }: { episode: Episode }) {
  const date = new Date(episode.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/ep/${episode.slug}`} className="group block">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-5 py-4 transition-all hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium text-zinc-900 transition-colors group-hover:text-amber-700 dark:text-zinc-100 dark:group-hover:text-amber-400">
            {episode.title}
          </h3>
          <time className="mt-1 block text-xs text-zinc-400">{date}</time>
        </div>
        <div className="flex items-center gap-3">
          {/* {episode.hasRawTranscript && (episode.status === "done" || episode.status === "error") && (
            <ReprocessButton episodeId={episode._id} />
          )} */}
          <StatusBadge status={episode.status} />
        </div>
      </div>
    </Link>
  );
}
