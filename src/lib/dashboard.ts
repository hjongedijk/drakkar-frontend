import type { DiscoverMediaItem, MediaLibraryItem } from "../api/client";

export function cleanSeriesTitle(value: string) {
  return value
    .replace(/\bS\d{1,2}E\d{1,3}\b.*$/i, "")
    .replace(/\bSeason\s+\d{1,2}\b.*$/i, "")
    .replace(/\bS\d{1,2}\b(?!E\d).*$/i, "")
    .replace(/[-_.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function mediaKey(item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }) {
  if (item.imdbId) return `${item.mediaType}:imdb:${item.imdbId}`;
  if (item.tmdbId) return `${item.mediaType}:tmdb:${item.tmdbId}`;
  if (item.tvdbId) return `${item.mediaType}:tvdb:${item.tvdbId}`;
  return `${item.mediaType}:${normalizeTitle(item.title)}:${item.year ?? ""}`;
}

export function buildWatchGroups(items: MediaLibraryItem[]) {
  const map = new Map<string, string>();
  for (const item of items) {
    const key = mediaKey(item);
    if (!map.has(key)) map.set(key, key);
  }
  return map;
}

export function matchingWatchGroup(
  item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null },
  watchGroups: Map<string, string>
) {
  return watchGroups.get(mediaKey(item));
}

function importCompletedMs(item: MediaLibraryItem) {
  const createdAt = Date.parse(item.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function recentActivityMs(item: MediaLibraryItem) {
  const createdAt = Date.parse(item.createdAt);
  const updatedAt = Date.parse(item.updatedAt);
  if (item.sourceKey.startsWith("import:")) {
    return Math.max(Number.isFinite(createdAt) ? createdAt : 0, 0);
  }
  return Math.max(
    Number.isFinite(createdAt) ? createdAt : 0,
    Number.isFinite(updatedAt) ? updatedAt : 0
  );
}

function isSeriesLevelItem(item: MediaLibraryItem) {
  return item.mediaType !== "tv" || (item.season == null && item.episode == null);
}

function hasExternalIdentity(item: MediaLibraryItem) {
  return Boolean(item.imdbId || item.tmdbId || item.tvdbId);
}

export function compareRecentlyAdded(a: MediaLibraryItem, b: MediaLibraryItem) {
  return importCompletedMs(b) - importCompletedMs(a) || recentActivityMs(b) - recentActivityMs(a) || a.title.localeCompare(b.title);
}

function compareRecentCardCandidate(a: MediaLibraryItem, b: MediaLibraryItem) {
  const posterScore = Number(Boolean(b.posterUrl || b.backdropUrl)) - Number(Boolean(a.posterUrl || a.backdropUrl));
  if (posterScore !== 0) return posterScore;
  const seriesLevelScore = Number(isSeriesLevelItem(b)) - Number(isSeriesLevelItem(a));
  if (seriesLevelScore !== 0) return seriesLevelScore;
  const externalIdScore = Number(hasExternalIdentity(b)) - Number(hasExternalIdentity(a));
  if (externalIdScore !== 0) return externalIdScore;
  return compareRecentlyAdded(a, b);
}

function mostRecentActivityMs(items: MediaLibraryItem[]) {
  return items.reduce((latest, item) => Math.max(latest, importCompletedMs(item), recentActivityMs(item)), 0);
}

function recentCardKey(item: MediaLibraryItem) {
  const title = item.mediaType === "tv" ? cleanSeriesTitle(item.title) : item.title;
  return `${item.mediaType}:${normalizeTitle(title)}:${item.year ?? ""}`;
}

function selectBestRecentItem(items: MediaLibraryItem[]) {
  if (items.length === 0) return undefined;
  return [...items].sort(compareRecentCardCandidate)[0] ?? items[0];
}

export function uniqueLibraryTitles(items: MediaLibraryItem[]) {
  const grouped = new Map<string, MediaLibraryItem[]>();
  for (const item of items) {
    const key = recentCardKey(item);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return [...grouped.values()]
    .map((bucket) => {
      const item = selectBestRecentItem(bucket);
      if (!item) return undefined;
      return {
        item,
        recentAt: mostRecentActivityMs(bucket)
      };
    })
    .filter((entry): entry is { item: MediaLibraryItem; recentAt: number } => Boolean(entry))
    .sort((a, b) => b.recentAt - a.recentAt || compareRecentCardCandidate(a.item, b.item))
    .map((entry) => entry.item);
}

export function fallbackHero(items: MediaLibraryItem[], watchGroups: Map<string, string>) {
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

export function buildHeroItems(
  discover: { movies?: DiscoverMediaItem[]; tv?: DiscoverMediaItem[] } | undefined,
  recentlyAdded: MediaLibraryItem[],
  watchGroups: Map<string, string>
) {
  const combined = [...(discover?.tv ?? []), ...(discover?.movies ?? [])]
    .filter((item) => item.backdropUrl)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      watchGroup: matchingWatchGroup(item, watchGroups)
    }));
  return combined.length > 0 ? combined : fallbackHero(uniqueLibraryTitles(recentlyAdded), watchGroups);
}
