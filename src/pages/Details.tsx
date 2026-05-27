import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Tv } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, type DiscoverMediaItem, type MediaLibraryItem, type MediaRequest } from "../api/client";
import { DraggableScroller } from "../components/DraggableScroller";
import { PosterCardLink } from "../components/PosterCardLink";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { useToast } from "../components/ToastProvider";
import { idFromSlug } from "../lib/detailsHref";

type DetailsGroup = {
  title: string;
  episodeLabel?: string | null;
  episodeTitle?: string | null;
  mediaType: "movie" | "tv";
  year?: number | null;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  season?: number | null;
  episode?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  availableItems: MediaLibraryItem[];
  request?: MediaRequest;
};

export function DetailsPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const routeParams = useParams<{ mediaType?: string; idSlug?: string }>();
  const [params] = useSearchParams();
  const mediaType = ((routeParams.mediaType || params.get("mediaType") || "movie") === "tv" ? "tv" : "movie") as "movie" | "tv";
  const title = params.get("title") || "";
  const year = numberParam(params.get("year"));
  const routeId = idFromSlug(routeParams.idSlug);
  const tmdbId = params.get("tmdbId") ?? (routeId && /^\d+$/.test(routeId) ? routeId : null);
  const tvdbId = params.get("tvdbId");
  const imdbId = params.get("imdbId") ?? (routeId?.startsWith("tt") ? routeId : null);
  const season = numberParam(params.get("season"));
  const episode = numberParam(params.get("episode"));
  const posterUrl = params.get("posterUrl");
  const backdropUrl = params.get("backdropUrl");
  const overview = params.get("overview");

  const library = useQuery({ queryKey: ["library"], queryFn: api.library, refetchInterval: 120000 });
  const requests = useQuery({ queryKey: ["requests", "summary"], queryFn: () => api.requestsSummary().then((result) => result.items), refetchInterval: 60000 });
  const richDetails = useQuery({
    queryKey: ["discover-details", mediaType, title, year, tmdbId, tvdbId, imdbId],
    queryFn: () => api.discoverDetails({ mediaType, title, year, tmdbId, tvdbId, imdbId }),
    enabled: Boolean(title || tmdbId || tvdbId || imdbId),
    staleTime: 12 * 60 * 60 * 1000
  });
  const createRequest = useMutation({
    mutationFn: () => api.createRequest({ mediaType, title: richDetails.data?.title ?? title, year: richDetails.data?.year ?? year, tmdbId: richDetails.data?.tmdbId ?? tmdbId, tvdbId: richDetails.data?.tvdbId ?? tvdbId, imdbId: richDetails.data?.imdbId ?? imdbId }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      notify(result.seerr?.ok ? "Request added and sent to Seerr." : "Request added locally. Seerr sync skipped or failed.", result.seerr?.ok ? "success" : "info");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Request failed.", "error")
  });

  const details = useMemo<DetailsGroup | null>(() => {
    if (!title && !richDetails.data?.title) return null;
    const effectiveTitle = richDetails.data?.title ?? title;
    const availableItems = (library.data ?? []).filter(
      (item) => item.libraryStatus === "available" && sameIdentity(item, { mediaType, title: effectiveTitle, year, tmdbId, tvdbId, imdbId, season, episode })
    );
    const request = (requests.data ?? []).find((item) => sameIdentity(item, { mediaType, title: effectiveTitle, year, tmdbId, tvdbId, imdbId, season, episode }));
    const leadItem = availableItems[0];
    const rich = richDetails.data;
    return {
      title: effectiveTitle,
      episodeLabel: season != null && episode != null ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : null,
      episodeTitle: leadItem?.episodeTitle ?? null,
      mediaType,
      year: rich?.year ?? year,
      tmdbId: rich?.tmdbId ?? tmdbId,
      tvdbId: rich?.tvdbId ?? tvdbId,
      imdbId: rich?.imdbId ?? imdbId,
      season,
      episode,
      posterUrl: rich?.posterUrl ?? posterUrl,
      backdropUrl: rich?.backdropUrl ?? backdropUrl,
      overview: rich?.overview ?? overview,
      availableItems,
      request
    };
  }, [library.data, requests.data, richDetails.data, mediaType, title, year, tmdbId, tvdbId, imdbId, season, episode, posterUrl, backdropUrl, overview]);

  const monitor = useQuery({
    queryKey: ["requests", details?.request?.id, "monitor"],
    queryFn: () => api.requestMonitor(details!.request!.id),
    enabled: details?.mediaType === "tv" && Boolean(details?.request?.id),
    refetchInterval: 30000
  });

  if (library.isLoading || requests.isLoading) return <LoadingState />;
  if (library.isError || requests.isError) return <ErrorState message="Could not load media details." />;
  if (!title && richDetails.isLoading) return <LoadingState />;
  if (!details) return <EmptyState message="No media details found." />;
  const rich = richDetails.data;
  const subtitleLanguages = [...new Set(details.availableItems.flatMap((item) => item.subtitleLanguages ?? []))].sort();

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10">
        {details.backdropUrl ? <img src={details.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-black/20" />
        <div className="relative min-h-[420px] p-6 md:p-10">
          <div className="mt-40 grid gap-6 md:grid-cols-[190px_1fr]">
            <Poster posterUrl={details.posterUrl} />
            <div className="space-y-4 self-end">
              <div className="flex flex-wrap gap-2">
                <Badge>{details.mediaType}</Badge>
                {details.year ? <Badge>{details.year}</Badge> : null}
                {details.episodeLabel ? <Badge>{details.episodeLabel}</Badge> : null}
                {rich?.runtimeMinutes ? <Badge>{formatRuntime(rich.runtimeMinutes)}</Badge> : null}
                {rich?.originalLanguage ? <Badge>{rich.originalLanguage.toUpperCase()}</Badge> : null}
                {details.request ? <Badge>{details.request.status}</Badge> : <Badge>not requested</Badge>}
                {details.availableItems.length > 0 ? <Badge>{details.availableItems.length} available</Badge> : null}
                {subtitleLanguages.length > 0 ? <Badge>Subs {subtitleLanguages.join(", ")}</Badge> : null}
              </div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{details.title}</h1>
              {rich?.tagline ? <p className="text-lg font-semibold text-white/80">{rich.tagline}</p> : null}
              {details.overview ? <p className="max-w-4xl text-sm leading-6 text-white/75 md:text-base">{details.overview}</p> : null}
              <div className="flex flex-wrap gap-2">
                {details.request ? (
                  <Button asChild><Link to="/library">Open Library</Link></Button>
                ) : (
                  <Button onClick={() => createRequest.mutate()} disabled={createRequest.isPending}>
                    <Download className="mr-2 h-4 w-4" />
                    Request
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {richDetails.isError ? <ErrorState message="Extra metadata could not load. Base details still available." /> : null}
      {rich ? (
        <>
          <InfoGrid details={rich} />
          <PeopleRow title="Cast" people={rich.cast} />
          <PosterRow title="Recommendations" items={rich.recommendations} />
          <PosterRow title="Similar" items={rich.similar} />
        </>
      ) : richDetails.isLoading ? <LoadingState /> : null}

      {details.mediaType === "tv" ? (
        monitor.isLoading ? <LoadingState /> : monitor.data ? <SeasonPanels monitor={monitor.data} /> : <EmptyState message="No season details found." />
      ) : null}
    </div>
  );
}

function Poster({ posterUrl }: { posterUrl?: string | null }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-muted shadow-2xl">
      {posterUrl ? <img src={posterUrl} alt="" className="w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center"><Tv className="h-10 w-10 text-muted-foreground" /></div>}
    </div>
  );
}

function InfoGrid({ details }: { details: NonNullable<Awaited<ReturnType<typeof api.discoverDetails>>> }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">More Details</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <InfoBox label="Rating" value={details.voteAverage ? `${details.voteAverage.toFixed(1)} / 10` : "unknown"} />
        <InfoBox label="Votes" value={details.voteCount ? String(details.voteCount) : "unknown"} />
        <InfoBox label="Budget" value={formatMoney(details.budget)} />
        <InfoBox label="Revenue" value={formatMoney(details.revenue)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {details.genres.map((genre) => <Badge key={genre}>{genre}</Badge>)}
        {details.productionCompanies.slice(0, 8).map((company) => <Badge key={company}>{company}</Badge>)}
      </div>
    </section>
  );
}

function PeopleRow({ title, people }: { title: string; people: NonNullable<Awaited<ReturnType<typeof api.discoverDetails>>>["cast"] }) {
  if (people.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <DraggableScroller className="gap-3">
        {people.map((person) => (
          <div key={`${person.id ?? person.name}:${person.character ?? ""}`} className="w-28 shrink-0 overflow-hidden rounded-xl border bg-card">
            <div className="aspect-[2/3] bg-muted">{person.profileUrl ? <img src={person.profileUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
            <div className="p-2">
              <p className="truncate text-xs font-bold">{person.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{person.character ?? "cast"}</p>
            </div>
          </div>
        ))}
      </DraggableScroller>
    </section>
  );
}

function PosterRow({ title, items }: { title: string; items: DiscoverMediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <DraggableScroller>
        {items.map((item) => (
          <PosterCardLink key={`${item.mediaType}:${item.tmdbId ?? item.title}`} item={item} meta={`${item.mediaType} · ${item.year ?? "unknown"}`} className="w-36 shrink-0" />
        ))}
      </DraggableScroller>
    </section>
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
                <span className="font-medium">E{String(episode.episodeNumber).padStart(2, "0")}{episode.title ? ` - ${episode.title}` : ""}</span>
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
  item: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null; season?: number | null; episode?: number | null },
  target: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null; season?: number | null; episode?: number | null }
) {
  if (item.mediaType !== target.mediaType) return false;
  const episodeScoped = target.season != null || target.episode != null;
  const sameEpisode = !episodeScoped || ((target.season ?? null) === (item.season ?? null) && (target.episode ?? null) === (item.episode ?? null));
  if (!sameEpisode) return false;
  if (target.imdbId && item.imdbId === target.imdbId) return true;
  if (target.tmdbId && item.tmdbId === target.tmdbId) return true;
  if (target.tvdbId && item.tvdbId === target.tvdbId) return true;
  return normalizeTitle(item.title) === normalizeTitle(target.title) && (item.year ?? null) === (target.year ?? null) && sameEpisode;
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function numberParam(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function formatMoney(value?: number) {
  if (!value) return "unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function episodeStatusLabel(status: "available" | "downloading" | "missing_monitored") {
  if (status === "available") return "Available";
  if (status === "downloading") return "Downloading";
  return "Missing";
}

function episodeStatusClass(status: "available" | "downloading" | "missing_monitored") {
  if (status === "available") return "bg-[#22c55e]/20 text-[#b2f5c2]";
  if (status === "downloading") return "bg-[#8b5cf6]/20 text-[#d5c2ff]";
  return "bg-[#ff5b5b]/20 text-[#ffc2c2]";
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
