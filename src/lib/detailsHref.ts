export type DetailsHrefItem = {
  mediaType: string;
  title: string;
  year?: number | null;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  season?: number | null;
  episode?: number | null;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "title";
}

export function detailsHref(item: DetailsHrefItem) {
  const mediaType = item.mediaType === "tv" ? "tv" : "movie";
  const id = item.tmdbId ?? item.tvdbId ?? item.imdbId;
  const idSlug = id ? `${id}-${slugify(item.title)}` : slugify(item.title);
  const params = new URLSearchParams();
  if (!item.tmdbId && item.tvdbId) params.set("tvdbId", item.tvdbId);
  if (!item.tmdbId && !item.tvdbId && item.imdbId) params.set("imdbId", item.imdbId);
  if (!id || item.title) params.set("title", item.title);
  if (item.year) params.set("year", String(item.year));
  if (typeof item.season === "number") params.set("season", String(item.season));
  if (typeof item.episode === "number") params.set("episode", String(item.episode));
  const query = params.toString();
  return `/details/${mediaType}/${idSlug}${query ? `?${query}` : ""}`;
}

export function idFromSlug(idSlug?: string) {
  if (!idSlug) return undefined;
  return idSlug.split("-")[0] || undefined;
}
