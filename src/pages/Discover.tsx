import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { detailsHref } from "../lib/detailsHref";

export function DiscoverPage() {
  const params = useParams<{ mediaType: string }>();
  const mediaType = params.mediaType === "tv" ? "tv" : "movie";
  const query = useInfiniteQuery({
    queryKey: ["discover-list", mediaType],
    queryFn: ({ pageParam }) => api.discoverList(mediaType, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message="Could not load trending media." />;

  const items = dedupeDiscoverItems(query.data?.pages.flatMap((page) => page.items) ?? []);
  if (items.length === 0) return <EmptyState message="No trending media found." />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{mediaType === "movie" ? "Trending Movies" : "Trending TV Shows"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Daily TMDB trending list with paging.</p>
        </div>
        <Link className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground" to="/dashboard">
          Back To Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => (
          <Link
            key={`${item.mediaType}:${item.tmdbId ?? item.tvdbId ?? item.imdbId ?? item.title}`}
            to={detailsHref(item)}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card"
          >
            <div className="aspect-[2/3] bg-muted">
              {item.posterUrl ? <img src={item.posterUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.mediaType} · {item.year ?? "unknown"}</p>
            </div>
          </Link>
        ))}
      </div>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            Load More
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function dedupeDiscoverItems<T extends { mediaType: string; tmdbId?: string; tvdbId?: string; imdbId?: string; title: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}:${item.tmdbId ?? item.tvdbId ?? item.imdbId ?? item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
