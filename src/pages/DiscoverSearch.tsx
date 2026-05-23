import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, type DiscoverMediaItem } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PosterCardLink, posterGridClass } from "../components/PosterCardLink";

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
      <PosterGrid title="Movies" items={results.data?.movies ?? []} />
      <PosterGrid title="TV Shows" items={results.data?.tv ?? []} />
    </div>
  );
}

function PosterGrid({ title, items }: { title: string; items: DiscoverMediaItem[] }) {
  if (items.length === 0) return <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No {title.toLowerCase()} found.</div>;
  return (
    <section className="space-y-3">
      <h2 className="section-title">{title}</h2>
      <div className={posterGridClass}>
        {items.map((item) => (
          <PosterCardLink key={`${item.mediaType}:${item.tmdbId ?? item.title}`} item={item} meta={`${item.mediaType} · ${item.year ?? "unknown"}`} />
        ))}
      </div>
    </section>
  );
}
