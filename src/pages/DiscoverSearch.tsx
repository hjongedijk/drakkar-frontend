import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, type DiscoverMediaItem } from "../api/client";
import { DraggableScroller } from "../components/DraggableScroller";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { detailsHref } from "../lib/detailsHref";

export function DiscoverSearchPage() {
  const [params] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const results = useQuery({
    queryKey: ["discover-search", query],
    queryFn: () => api.discoverSearch(query),
    enabled: query.length > 0
  });

  if (!query) return <EmptyState message="Search movies and shows from the top bar." />;
  if (results.isLoading) return <LoadingState />;
  if (results.isError) return <ErrorState message="Could not search metadata." />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Search: {query}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Metadata results. Pick a poster to open details or request it.</p>
      </div>
      <PosterRow title="Movies" items={results.data?.movies ?? []} />
      <PosterRow title="TV Shows" items={results.data?.tv ?? []} />
    </div>
  );
}

function PosterRow({ title, items }: { title: string; items: DiscoverMediaItem[] }) {
  if (items.length === 0) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No {title.toLowerCase()} found.</div>;
  return (
    <section className="space-y-3">
      <h2 className="section-title">{title}</h2>
      <DraggableScroller>
        {items.map((item) => (
          <Link key={`${item.mediaType}:${item.tmdbId ?? item.title}`} to={detailsHref(item)} className="group w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-card" draggable={false}>
            <div className="aspect-[2/3] bg-muted">
              {item.posterUrl ? <img src={item.posterUrl} alt="" draggable={false} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.mediaType} · {item.year ?? "unknown"}</p>
            </div>
          </Link>
        ))}
      </DraggableScroller>
    </section>
  );
}
