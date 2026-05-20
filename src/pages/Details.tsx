import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Eye, Tv } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type MediaLibraryItem, type MediaRequest } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";

type DetailsGroup = {
  title: string;
  mediaType: "movie" | "tv";
  year?: number | null;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  availableItems: MediaLibraryItem[];
  request?: MediaRequest;
};

export function DetailsPage() {
  const [params] = useSearchParams();
  const mediaType = (params.get("mediaType") || "movie") as "movie" | "tv";
  const title = params.get("title") || "";
  const year = numberParam(params.get("year"));
  const tmdbId = params.get("tmdbId");
  const tvdbId = params.get("tvdbId");
  const imdbId = params.get("imdbId");
  const posterUrl = params.get("posterUrl");
  const backdropUrl = params.get("backdropUrl");
  const overview = params.get("overview");

  const library = useQuery({ queryKey: ["library"], queryFn: api.library, refetchInterval: 120000 });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.requests, refetchInterval: 60000 });

  const details = useMemo<DetailsGroup | null>(() => {
    if (!title) return null;
    const availableItems = (library.data ?? []).filter(
      (item) => item.libraryStatus === "available" && sameIdentity(item, { mediaType, title, year, tmdbId, tvdbId, imdbId })
    );
    const request = (requests.data ?? []).find((item) => sameIdentity(item, { mediaType, title, year, tmdbId, tvdbId, imdbId }));
    return {
      title,
      mediaType,
      year,
      tmdbId,
      tvdbId,
      imdbId,
      posterUrl,
      backdropUrl,
      overview,
      availableItems,
      request
    };
  }, [library.data, requests.data, mediaType, title, year, tmdbId, tvdbId, imdbId, posterUrl, backdropUrl, overview]);

  const monitor = useQuery({
    queryKey: ["requests", details?.request?.id, "monitor"],
    queryFn: () => api.requestMonitor(details!.request!.id),
    enabled: details?.mediaType === "tv" && Boolean(details?.request?.id),
    refetchInterval: 30000
  });

  if (library.isLoading || requests.isLoading) return <LoadingState />;
  if (library.isError || requests.isError) return <ErrorState message="Could not load media details." />;
  if (!details) return <EmptyState message="No media details found." />;

  const watchLink = details.availableItems[0]
    ? `/watch?group=${encodeURIComponent(groupKey(details.availableItems[0]))}&item=${encodeURIComponent(details.availableItems[0].id)}`
    : "/watch";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10">
        {details.backdropUrl ? <img src={details.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" /> : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/45" />
        <div className="relative grid gap-5 p-6 md:grid-cols-[220px_1fr] md:p-8">
          <div className="overflow-hidden rounded-2xl border bg-muted">
            {details.posterUrl ? <img src={details.posterUrl} alt="" className="w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center"><Tv className="h-10 w-10 text-muted-foreground" /></div>}
          </div>
          <div className="space-y-4 self-end">
            <div className="flex flex-wrap gap-2">
              <Badge>{details.mediaType}</Badge>
              {details.year ? <Badge>{details.year}</Badge> : null}
              {details.availableItems.length > 0 ? <Badge>{details.availableItems.length} available</Badge> : null}
              {details.request ? <Badge>{details.request.status}</Badge> : null}
            </div>
            <h1 className="text-4xl font-bold md:text-5xl">{details.title}</h1>
            {details.overview ? <p className="max-w-3xl text-sm text-white/75 md:text-base">{details.overview}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button className="w-full sm:w-auto" asChild variant="outline" disabled={details.availableItems.length === 0}>
                <Link to={watchLink}>
                  <Eye className="mr-2 h-4 w-4" />
                  Watch
                </Link>
              </Button>
              <Button className="w-full sm:w-auto" asChild>
                <Link to="/library">Open Library</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {details.mediaType === "tv" ? (
        monitor.isLoading ? <LoadingState /> : monitor.data ? <SeasonPanels monitor={monitor.data} /> : <EmptyState message="No season details found." />
      ) : (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Movie Status</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoBox label="Availability" value={details.availableItems.length > 0 ? "Available" : "Missing"} />
            <InfoBox label="Request" value={details.request?.status ?? "Not requested"} />
            <InfoBox label="Watch" value={details.availableItems.length > 0 ? "Ready" : "Unavailable"} />
          </div>
        </section>
      )}
    </div>
  );
}

function SeasonPanels({ monitor }: { monitor: NonNullable<Awaited<ReturnType<typeof api.requestMonitor>>> }) {
  return (
    <div className="space-y-4">
      {monitor.seasons.map((season) => (
        <details key={season.seasonNumber} className="rounded-2xl border bg-card" open={season.missingCount > 0 || season.downloadingCount > 0}>
          <summary className="flex list-none cursor-pointer items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="text-lg font-semibold">Season {String(season.seasonNumber).padStart(2, "0")}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge>{season.availableCount}/{season.episodeCount} available</Badge>
                {season.downloadingCount > 0 ? <Badge>downloading {season.downloadingCount}</Badge> : null}
                {season.missingCount > 0 ? <Badge>{season.missingCount} missing</Badge> : null}
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </summary>
          <div className="grid gap-2 border-t px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {season.episodes.map((episode) => (
              <div key={episode.episodeNumber} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <span className="font-medium">E{String(episode.episodeNumber).padStart(2, "0")}</span>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${episodeStatusClass(episode.status)}`}>{episodeStatusLabel(episode.status)}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function sameIdentity(
  item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null },
  target: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }
) {
  if (item.mediaType !== target.mediaType) return false;
  if (target.imdbId && item.imdbId === target.imdbId) return true;
  if (target.tmdbId && item.tmdbId === target.tmdbId) return true;
  if (target.tvdbId && item.tvdbId === target.tvdbId) return true;
  return normalizeTitle(item.title) === normalizeTitle(target.title) && (item.year ?? null) === (target.year ?? null);
}

function groupKey(item: MediaLibraryItem) {
  if (item.imdbId) return `${item.mediaType}:imdb:${item.imdbId}`;
  if (item.tmdbId) return `${item.mediaType}:tmdb:${item.tmdbId}`;
  if (item.tvdbId) return `${item.mediaType}:tvdb:${item.tvdbId}`;
  return `${item.mediaType}:${normalizeTitle(item.title)}:${item.year ?? ""}`;
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function numberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function episodeStatusLabel(status: "available" | "downloading" | "missing_monitored" | "missing_unmonitored") {
  if (status === "available") return "Available";
  if (status === "downloading") return "Downloading";
  if (status === "missing_monitored") return "Missing";
  return "Not Monitored";
}

function episodeStatusClass(status: "available" | "downloading" | "missing_monitored" | "missing_unmonitored") {
  if (status === "available") return "bg-[#22c55e]/20 text-[#b2f5c2]";
  if (status === "downloading") return "bg-[#8b5cf6]/20 text-[#d5c2ff]";
  if (status === "missing_monitored") return "bg-[#ff5b5b]/20 text-[#ffc2c2]";
  return "bg-[#ffab24]/20 text-[#ffd79a]";
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
