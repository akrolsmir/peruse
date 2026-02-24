import Link from "next/link";

interface Feed {
  _id: string;
  title: string;
  slug: string;
  episodes: string;
  lastFetchedAt: number;
  imageUrl?: string;
}

export function FeedCard({ feed }: { feed: Feed }) {
  const episodeCount = JSON.parse(feed.episodes).length;
  const lastFetched = new Date(feed.lastFetchedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/feeds/${feed.slug}`} className="group block">
      <div className="flex items-center gap-4 rounded-xl border border-zinc-200 px-5 py-4 transition-all hover:border-zinc-300 hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50">
        {feed.imageUrl && (
          <img src={feed.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium text-zinc-900 transition-colors group-hover:text-amber-700 dark:text-zinc-100 dark:group-hover:text-amber-400">
            {feed.title}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {episodeCount} episode{episodeCount !== 1 ? "s" : ""} · fetched {lastFetched}
          </p>
        </div>
      </div>
    </Link>
  );
}
