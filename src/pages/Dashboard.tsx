import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DiscoverMediaItem, type MediaLibraryItem } from "../api/client";
import { DraggableScroller } from "../components/DraggableScroller";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { PosterCardLink } from "../components/PosterCardLink";
import { detailsHref } from "../lib/detailsHref";

export function Dashboard() {
  const [heroIndex, setHeroIndex] = useState(0);
  const library = useQuery({ queryKey: ["library"], queryFn: api.library, refetchInterval: 120000 });
  const discover = useQuery({ queryKey: ["discover-home"], queryFn: api.discoverHome, refetchInterval: 180000 });

  const availableLibrary = useMemo(
    () => (library.data ?? []).filter((item) => item.libraryStatus === "available"),
    [library.data]
  );
  const recentlyAdded = useMemo(
    () =>
      uniqueLibraryTitles(availableLibrary
        .filter((item) => item.sourceKey.startsWith("import:"))
        .sort(compareRecentlyAdded))
        .slice(0, 12),
    [availableLibrary]
  );
  const watchGroups = useMemo(() => buildWatchGroups(availableLibrary), [availableLibrary]);
  const heroItems = useMemo(() => {
    const combined = [...(discover.data?.tv ?? []), ...(discover.data?.movies ?? [])]
      .filter((item) => item.backdropUrl)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        watchGroup: matchingWatchGroup(item, watchGroups)
      }));
    return combined.length > 0 ? combined : fallbackHero(uniqueLibraryTitles(recentlyAdded), watchGroups);
  }, [discover.data, recentlyAdded, watchGroups]);

  useEffect(() => {
    if (heroItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIndex((value) => (value + 1) % heroItems.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroItems.length]);

  useEffect(() => {
    if (heroIndex >= heroItems.length) setHeroIndex(0);
  }, [heroIndex, heroItems.length]);

  if (library.isLoading || discover.isLoading) return <LoadingState />;
  if (library.isError || discover.isError) return <ErrorState message="Could not load dashboard." />;
  if (heroItems.length === 0 && recentlyAdded.length === 0) return <EmptyState message="No media found yet." />;

  const hero = heroItems[heroIndex] ?? heroItems[0];

  return (
    <div className="space-y-8">
      {hero ? (
        <section className="relative h-[420px] overflow-hidden rounded-[32px] border border-white/10 md:h-[500px]">
          {hero.backdropUrl ? <img src={hero.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/35" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/75 to-transparent" />
          <div className="relative flex h-full items-end p-6 md:p-10">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase">{hero.mediaType}</span>
                {hero.year ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold">{hero.year}</span> : null}
              </div>
              <h1 className="line-clamp-2 min-h-[5rem] text-4xl font-bold tracking-tight md:min-h-[6rem] md:text-6xl">{hero.title}</h1>
              {hero.overview ? <p className="mt-4 line-clamp-3 min-h-[4.5rem] max-w-2xl text-sm text-white/75 md:text-lg">{hero.overview}</p> : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/10 px-6 text-sm font-bold" to={detailsHref(hero)}>
                  More Info
                </Link>
              </div>
            </div>
          </div>
          {heroItems.length > 1 ? (
            <>
              <button
                className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/35"
                onClick={() => setHeroIndex((value) => (value - 1 + heroItems.length) % heroItems.length)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/35"
                onClick={() => setHeroIndex((value) => (value + 1) % heroItems.length)}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2">
                {heroItems.map((item, index) => (
                  <button
                    key={`${item.mediaType}:${item.tmdbId ?? item.tvdbId ?? item.title}`}
                    className={`h-1.5 rounded-full transition-all ${index === heroIndex ? "w-10 bg-primary" : "w-4 bg-white/30"}`}
                    onClick={() => setHeroIndex(index)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <MediaRow title="Recently Added" items={recentlyAdded} linkTo="/library" linkLabel="View Library" />
      <MediaRow title="Trending Movies" items={discover.data?.movies ?? []} linkTo="/discover/movie" linkLabel="View All" />
      <MediaRow title="Trending TV Shows" items={discover.data?.tv ?? []} linkTo="/discover/tv" linkLabel="View All" />
    </div>
  );
}

function fallbackHero(items: MediaLibraryItem[], watchGroups: Map<string, string>) {
  return items
    .filter((item) => item.backdropUrl || item.posterUrl)
    .slice(0, 8)
    .map((item) => ({
      mediaType: item.mediaType as "movie" | "tv",
      title: item.title,
      year: item.year ?? undefined,
      tmdbId: item.tmdbId ?? undefined,
      tvdbId: item.tvdbId ?? undefined,
      imdbId: item.imdbId ?? undefined,
      posterUrl: item.posterUrl ?? undefined,
      backdropUrl: item.backdropUrl ?? item.posterUrl ?? undefined,
      overview: item.overview ?? undefined,
      watchGroup: matchingWatchGroup(item, watchGroups)
    }));
}

function buildWatchGroups(items: MediaLibraryItem[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    const key = mediaKey(item);
    if (!map.has(key)) {
      const group = item.imdbId
        ? `${item.mediaType}:imdb:${item.imdbId}`
        : item.tmdbId
          ? `${item.mediaType}:tmdb:${item.tmdbId}`
          : item.tvdbId
            ? `${item.mediaType}:tvdb:${item.tvdbId}`
            : `${item.mediaType}:${normalizeTitle(item.title)}:${item.year ?? ""}`;
      map.set(key, group);
    }
  }
  return map;
}

function matchingWatchGroup(item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }, watchGroups: Map<string, string>) {
  return watchGroups.get(mediaKey(item));
}

function mediaKey(item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }) {
  if (item.imdbId) return `${item.mediaType}:imdb:${item.imdbId}`;
  if (item.tmdbId) return `${item.mediaType}:tmdb:${item.tmdbId}`;
  if (item.tvdbId) return `${item.mediaType}:tvdb:${item.tvdbId}`;
  return `${item.mediaType}:${normalizeTitle(item.title)}:${item.year ?? ""}`;
}

function uniqueLibraryTitles(items: MediaLibraryItem[]) {
  const seen = new Set<string>();
  return items
    .sort(compareRecentlyAdded)
    .filter((item) => {
      const key = mediaKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function MediaRow({
  title,
  items,
  linkTo,
  linkLabel
}: {
  title: string;
  items: Array<MediaLibraryItem | DiscoverMediaItem>;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{title}</h2>
        <Link className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground" to={linkTo}>
          {linkLabel}
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No items yet.</div>
      ) : (
        <DraggableScroller>
          {items.map((item) => (
            <PosterCardLink
              key={`${item.mediaType}:${item.tmdbId ?? item.tvdbId ?? item.imdbId ?? item.title}`}
              item={item}
              title={recentTitle(item)}
              meta={recentMeta(item)}
              className="w-40 shrink-0"
            />
          ))}
        </DraggableScroller>
      )}
    </section>
  );
}

function recentTitle(item: MediaLibraryItem | DiscoverMediaItem) {
  return item.title;
}

function recentMeta(item: MediaLibraryItem | DiscoverMediaItem) {
  if ("season" in item && typeof item.season === "number" && typeof item.episode === "number") {
    return `${item.mediaType} · ${item.year ?? "unknown"} · ${episodeCode(item.season, item.episode)}`;
  }
  if ("season" in item && typeof item.season === "number") {
    return `${item.mediaType} · ${item.year ?? "unknown"} · Season ${String(item.season).padStart(2, "0")}`;
  }
  return `${item.mediaType} · ${item.year ?? "unknown"}`;
}

function episodeCode(season: number, episode: number) {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

function compareRecentlyAdded(a: MediaLibraryItem, b: MediaLibraryItem) {
  return (
    Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
  );
}
