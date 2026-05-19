import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Eye, RefreshCw, Search, Sparkles, Trash2, Tv } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type MediaLibraryItem, type MediaRequest, type Release, type RequestMonitor } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ToastProvider";

type LibraryGroup = {
  key: string;
  mediaType: "movie" | "tv";
  title: string;
  year?: number | null;
  tmdbId?: string | null;
  tvdbId?: string | null;
  imdbId?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string | null;
  request?: MediaRequest;
  items: MediaLibraryItem[];
  availableItems: MediaLibraryItem[];
  missingCount: number;
  availableCount: number;
  downloadingCount: number;
};

function cleanSeriesTitle(value: string) {
  return value
    .replace(/\bS\d{1,2}E\d{1,3}\b.*$/i, "")
    .replace(/\bSeason\s+\d{1,2}\b.*$/i, "")
    .replace(/\bS\d{1,2}\b(?!E\d).*$/i, "")
    .replace(/[-_.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const monitorLegend = [
  { label: "Continuing (All episodes downloaded)", classes: "bg-[#5f98ff]" },
  { label: "Ended (All episodes downloaded)", classes: "bg-[#22c55e]" },
  { label: "Missing Episodes (Series monitored)", classes: "bg-[#ff5b5b]" },
  { label: "Missing Episodes (Series not monitored)", classes: "bg-[#ffab24]" },
  { label: "Downloading (One or more episodes)", classes: "bg-[#8b5cf6]" }
];

const activeRequestStatuses = new Set(["pending", "approved", "requested", "searching", "grabbed"]);

function requestIsQueued(request?: MediaRequest) {
  return Boolean(request && activeRequestStatuses.has(request.status));
}

export function Library() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [tab, setTab] = useState<"all" | "movie" | "tv">("all");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<{ item: MediaLibraryItem; releases: Release[] } | null>(null);

  const items = useQuery({ queryKey: ["library"], queryFn: api.library, refetchInterval: 60000 });
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.requests, refetchInterval: 30000 });
  const syncRequests = useMutation({
    mutationFn: api.syncRequests,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      const failed = result.providerResults.filter((item) => !item.ok);
      if (result.imported > 0) {
        const suffix = failed.length > 0 ? ` ${failed.length} provider failed.` : "";
        notify(`Imported ${result.imported} request${result.imported === 1 ? "" : "s"}.${suffix}`, failed.length > 0 ? "info" : "success");
        return;
      }
      if (failed.length > 0) {
        notify(failed[0]?.error ?? "Request sync failed.", "error");
        return;
      }
      notify("No new requests found.", "info");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Request sync failed.", "error")
  });
  const grabRequest = useMutation({
    mutationFn: (id: string) => api.grabRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      notify("Missing items queued.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not queue missing items.", "error")
  });
  const deleteItem = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.deleteLibraryItem(id))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      setReplacement(null);
      notify("Library item deleted.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Delete failed.", "error")
  });
  const searchReplacement = useMutation({
    mutationFn: api.searchLibraryReplacements,
    onSuccess: (result) => {
      setReplacement(result);
      notify(`Found ${result.releases.length} replacement releases.`, "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Replacement search failed.", "error")
  });
  const autoReplace = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => api.autoReplaceLibraryItem(id))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      notify("Automatic replacement queued.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Auto replacement failed.", "error")
  });
  const replaceWithRelease = useMutation({
    mutationFn: ({ id, release }: { id: string; release: Release }) => api.replaceLibraryItem(id, release),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      setReplacement(null);
      notify("Selected replacement queued.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Manual replacement failed.", "error")
  });

  const groups = useMemo(() => buildGroups(items.data ?? [], requests.data ?? []), [items.data, requests.data]);
  const visibleGroups = groups.filter((group) => tab === "all" || group.mediaType === tab);
  const activeGroup = visibleGroups.find((group) => group.key === activeKey) ?? groups.find((group) => group.key === activeKey) ?? null;

  if (items.isLoading || requests.isLoading) return <LoadingState />;
  if (items.isError || requests.isError) return <ErrorState message="Could not load library monitor." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Requested media, monitored availability, and imported files in one place.</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-flow-col sm:grid-cols-none">
          {(["all", "movie", "tv"] as const).map((value) => (
            <Button key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>{value}</Button>
          ))}
          <Button variant="outline" onClick={() => syncRequests.mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Monitored Titles" value={groups.length} />
        <Metric label="Available Items" value={groups.reduce((sum, group) => sum + group.availableCount, 0)} />
        <Metric label="Downloading" value={groups.reduce((sum, group) => sum + group.downloadingCount, 0)} />
        <Metric label="Missing" value={groups.reduce((sum, group) => sum + group.missingCount, 0)} />
      </section>

      <section className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4 text-xs">
        {monitorLegend.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`h-3 w-8 rounded-full ${item.classes}`} />
            <span className="text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </section>

      {visibleGroups.length === 0 ? (
        <EmptyState message="No monitored or available items found." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
          {visibleGroups.map((group) => (
            <PosterCard key={group.key} group={group} onOpen={() => setActiveKey(group.key)} />
          ))}
        </div>
      )}

      {activeGroup ? (
        <LibraryDetails
          group={activeGroup}
          replacement={replacement}
          onClose={() => {
            setActiveKey(null);
            setReplacement(null);
          }}
          onWatch={() => navigate(`/watch?group=${encodeURIComponent(activeGroup.key)}`)}
          onGrabMissing={(requestId) => {
            notify("Queueing missing items...", "info");
            grabRequest.mutate(requestId);
          }}
          onDelete={(ids) => {
            notify("Deleting library item...", "info");
            deleteItem.mutate(ids);
          }}
          onSearchReplace={(id) => {
            notify("Searching replacement releases...", "info");
            searchReplacement.mutate(id);
          }}
          onAutoReplace={(ids) => {
            notify("Queueing automatic replacement...", "info");
            autoReplace.mutate(ids);
          }}
          onReplaceRelease={(id, release) => {
            notify("Queueing selected replacement...", "info");
            replaceWithRelease.mutate({ id, release });
          }}
        />
      ) : null}
    </div>
  );
}

function buildGroups(items: MediaLibraryItem[], requests: MediaRequest[]): LibraryGroup[] {
  const groups = new Map<string, LibraryGroup>();
  const requestByKey = new Map<string, MediaRequest>();

  for (const request of requests) {
    const key = groupKey({
      mediaType: request.mediaType,
      title: request.title,
      year: request.year,
      tmdbId: request.tmdbId,
      tvdbId: request.tvdbId,
      imdbId: request.imdbId
    });
    requestByKey.set(key, request);
    groups.set(key, {
      key,
      mediaType: request.mediaType as "movie" | "tv",
      title: request.mediaType === "tv" ? cleanSeriesTitle(request.title) : request.title,
      year: request.year,
      tmdbId: request.tmdbId,
      tvdbId: request.tvdbId,
      imdbId: request.imdbId,
      posterUrl: undefined,
      backdropUrl: undefined,
      overview: undefined,
      request,
      items: [],
      availableItems: [],
      missingCount: request.mediaType === "movie" ? 1 : 0,
      availableCount: 0,
      downloadingCount: requestIsQueued(request) ? 1 : 0
    });
  }

  for (const item of dedupeLibraryItems(items)) {
    const key = groupKey(item);
    const request = requestByKey.get(key);
    const group = groups.get(key) ?? {
      key,
      mediaType: item.mediaType as "movie" | "tv",
      title: item.mediaType === "tv" ? cleanSeriesTitle(item.title) : item.title,
      year: item.year,
      tmdbId: item.tmdbId,
      tvdbId: item.tvdbId,
      imdbId: item.imdbId,
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl,
      overview: item.overview,
      request,
      items: [],
      availableItems: [],
      missingCount: 0,
      availableCount: 0,
      downloadingCount: 0
    };
    group.posterUrl ??= item.posterUrl;
    group.backdropUrl ??= item.backdropUrl;
    group.overview ??= item.overview;
    group.items.push(item);
    if (item.libraryStatus === "available") {
      group.availableItems.push(item);
      group.availableCount += 1;
    }
    if (item.libraryStatus === "grabbed" || item.libraryStatus === "searching" || item.libraryStatus === "requested") {
      group.downloadingCount += 1;
    }
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.mediaType === "movie") {
      group.missingCount = group.availableCount > 0 ? 0 : group.request ? 1 : 0;
      group.downloadingCount = group.availableCount > 0 ? 0 : requestIsQueued(group.request) ? 1 : 0;
    } else {
      group.missingCount = Math.max(0, countRequestedEpisodes(group.request) - group.availableCount);
      if (!requestIsQueued(group.request)) group.downloadingCount = 0;
    }
  }

  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function dedupeLibraryItems(items: MediaLibraryItem[]) {
  const best = new Map<string, MediaLibraryItem>();
  for (const item of items) {
    const key = itemKey(item);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      continue;
    }
    if (item.libraryStatus === "available" && existing.libraryStatus !== "available") {
      best.set(key, item);
      continue;
    }
    if (item.sourceKey.startsWith("import:") && !existing.sourceKey.startsWith("import:")) {
      best.set(key, item);
    }
  }
  return [...best.values()];
}

function countRequestedEpisodes(request?: MediaRequest) {
  if (!request || request.mediaType !== "tv") return 0;
  if (Array.isArray(request.episodes) && request.episodes.length > 0) return request.episodes.length;
  if (Array.isArray(request.seasons) && request.seasons.length > 0) {
    return request.seasons.reduce((sum, season) => {
      if (typeof season === "number") return sum + season;
      if (typeof season === "string" && /^\d+$/.test(season)) return sum + Number(season);
      if (season && typeof season === "object") {
        const row = season as Record<string, unknown>;
        if (typeof row.episodeCount === "number") return sum + row.episodeCount;
        if (typeof row.episodesCount === "number") return sum + row.episodesCount;
        if (typeof row.totalEpisodes === "number") return sum + row.totalEpisodes;
        if (Array.isArray(row.episodes)) return sum + row.episodes.length;
      }
      return sum + 1;
    }, 0);
  }
  return 0;
}

function groupKey(input: { mediaType: string; title: string; year?: number | null; tmdbId?: string | null; tvdbId?: string | null; imdbId?: string | null }) {
  const title = input.mediaType === "tv" ? cleanSeriesTitle(input.title) : input.title;
  if (input.imdbId) return `${input.mediaType}:imdb:${input.imdbId}`;
  if (input.tmdbId) return `${input.mediaType}:tmdb:${input.tmdbId}`;
  if (input.tvdbId) return `${input.mediaType}:tvdb:${input.tvdbId}`;
  return `${input.mediaType}:${normalizeTitle(title)}:${input.year ?? ""}`;
}

function itemKey(item: MediaLibraryItem) {
  return `${groupKey(item)}:${item.season ?? ""}:${item.episode ?? ""}`;
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function PosterCard({ group, onOpen }: { group: LibraryGroup; onOpen: () => void }) {
  const status = groupStatus(group);
  return (
    <button className="overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary" onClick={onOpen}>
      <div className="aspect-[2/3] bg-muted">
        {group.posterUrl ? <img src={group.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-muted-foreground"><Tv className="h-7 w-7" /></div>}
      </div>
      <div className={`h-1 ${status.color}`} />
      <div className="space-y-1 p-2.5">
        <p className="truncate text-xs font-semibold sm:text-sm">{group.title}</p>
        <p className="text-[11px] text-muted-foreground">{group.mediaType === "tv" ? `${group.availableCount} available · ${group.missingCount} missing` : movieSummary(group)}</p>
        <Badge>{status.label}</Badge>
      </div>
    </button>
  );
}

function LibraryDetails({
  group,
  replacement,
  onClose,
  onWatch,
  onGrabMissing,
  onDelete,
  onSearchReplace,
  onAutoReplace,
  onReplaceRelease
}: {
  group: LibraryGroup;
  replacement: { item: MediaLibraryItem; releases: Release[] } | null;
  onClose: () => void;
  onWatch: () => void;
  onGrabMissing: (requestId: string) => void;
  onDelete: (ids: string[]) => void;
  onSearchReplace: (id: string) => void;
  onAutoReplace: (ids: string[]) => void;
  onReplaceRelease: (id: string, release: Release) => void;
}) {
  const monitor = useQuery({
    queryKey: ["requests", group.request?.id, "monitor"],
    queryFn: () => api.requestMonitor(group.request!.id),
    enabled: group.mediaType === "tv" && Boolean(group.request?.id),
    refetchInterval: 30000
  });

  const standaloneSeasons = useMemo(() => {
    const bySeason = new Map<number, MediaLibraryItem[]>();
    for (const item of group.items) {
      if (item.season == null || item.episode == null) continue;
      const rows = bySeason.get(item.season) ?? [];
      rows.push(item);
      bySeason.set(item.season, rows);
    }
    return [...bySeason.entries()].sort(([a], [b]) => a - b);
  }, [group.items]);
  const primaryAvailable = group.availableItems[0];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] max-w-6xl overflow-auto rounded-3xl border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="relative min-h-[260px] overflow-hidden border-b">
          {group.backdropUrl ? <img src={group.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/30" />
          <div className="relative grid gap-5 p-6 md:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-2xl border bg-muted">
              {group.posterUrl ? <img src={group.posterUrl} alt="" className="w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center text-muted-foreground"><Tv className="h-10 w-10" /></div>}
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-4xl font-bold">{group.title}{group.year ? ` (${group.year})` : ""}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{group.mediaType}</Badge>
                    <Badge>{groupStatus(group).label}</Badge>
                    <Badge>{group.availableCount} available</Badge>
                    {group.missingCount > 0 ? <Badge>{group.missingCount} missing</Badge> : null}
                  </div>
                </div>
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
              {group.overview ? <p className="max-w-3xl text-sm text-muted-foreground">{group.overview}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onWatch} disabled={group.availableItems.length === 0}>
                  <Eye className="mr-2 h-4 w-4" />
                  Watch
                </Button>
                {group.request?.id ? (
                  <Button onClick={() => onGrabMissing(group.request!.id)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Missing
                  </Button>
                ) : null}
                {primaryAvailable ? (
                  <>
                    <Button variant="outline" onClick={() => onSearchReplace(primaryAvailable.id)}>
                      <Search className="mr-2 h-4 w-4" />
                      Manual Replace
                    </Button>
                    <Button variant="outline" onClick={() => onAutoReplace(group.availableItems.map((item) => item.id))}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Auto Replace
                    </Button>
                    <Button variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20" onClick={() => onDelete(group.availableItems.map((item) => item.id))}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Available
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {replacement ? <ReplacementPanel replacement={replacement} onGrab={onReplaceRelease} /> : null}
          {group.mediaType === "tv" ? (
            monitor.data ? <MonitorSeasonList monitor={monitor.data} /> : monitor.isLoading ? <LoadingState /> : <ImportSeasonList seasons={standaloneSeasons} />
          ) : (
            <MovieStatusPanel group={group} />
          )}
        </div>
      </div>
    </div>
  );
}

function groupStatus(group: LibraryGroup) {
  if (group.mediaType === "movie") {
    if (group.downloadingCount > 0) return { label: "Queued", color: "bg-[#8b5cf6]" };
    if (group.availableCount > 0) return group.request
      ? { label: "Downloaded (Monitored)", color: "bg-[#22c55e]" }
      : { label: "Downloaded (Unmonitored)", color: "bg-[#7c8596]" };
    return group.request
      ? { label: "Missing (Monitored)", color: "bg-[#ff5b5b]" }
      : { label: "Missing (Unmonitored)", color: "bg-[#ffab24]" };
  }

  if (group.downloadingCount > 0) return { label: "Downloading", color: "bg-[#8b5cf6]" };
  if (group.missingCount > 0 && group.request) return { label: "Missing Episodes", color: "bg-[#ff5b5b]" };
  if (group.missingCount > 0) return { label: "Missing Episodes", color: "bg-[#ffab24]" };
  if (group.availableCount > 0 && group.request) return { label: "Continuing", color: "bg-[#5f98ff]" };
  if (group.availableCount > 0) return { label: "Ended", color: "bg-[#22c55e]" };
  return { label: "Queued", color: "bg-[#8b5cf6]" };
}

function movieSummary(group: LibraryGroup) {
  if (group.availableCount > 0) return group.request ? "Downloaded" : "Downloaded (unmonitored)";
  if (group.downloadingCount > 0) return "Queued";
  return group.request ? "Missing" : "Missing (unmonitored)";
}

function MovieStatusPanel({ group }: { group: LibraryGroup }) {
  const requestStatus = group.request?.status ?? "not_requested";
  const available = group.availableItems[0];
  return (
    <div className="rounded-2xl border bg-background/40 p-5">
      <h3 className="mb-4 text-lg font-semibold">Movie Status</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoBox label="Request" value={requestStatus} />
        <InfoBox label="Availability" value={available ? "available" : "missing"} />
        <InfoBox label="Library" value={available ? "ready to watch" : "not available"} />
      </div>
    </div>
  );
}

function MonitorSeasonList({ monitor }: { monitor: RequestMonitor }) {
  return (
    <div className="space-y-4">
      {monitor.seasons.map((season) => (
        <details key={season.seasonNumber} className="rounded-2xl border bg-background/30" open={season.missingCount > 0 || season.downloadingCount > 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
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
          <div className="border-t px-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {season.episodes.map((episode) => (
                <div key={episode.episodeNumber} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <span className="min-w-0 truncate font-medium">
                    E{String(episode.episodeNumber).padStart(2, "0")}
                    {episode.title ? ` - ${episode.title}` : ""}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${episodeStatusClass(episode.status)}`}>{episodeStatusLabel(episode.status)}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function ImportSeasonList({ seasons }: { seasons: Array<[number, MediaLibraryItem[]]> }) {
  return (
    <div className="space-y-4">
      {seasons.map(([seasonNumber, items]) => (
        <details key={seasonNumber} className="rounded-2xl border bg-background/30" open>
          <summary className="cursor-pointer list-none px-4 py-4 text-lg font-semibold">Season {String(seasonNumber).padStart(2, "0")}</summary>
          <div className="grid gap-2 border-t px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <span className="min-w-0 truncate font-medium">
                  E{String(item.episode ?? 0).padStart(2, "0")}
                  {item.episodeTitle ? ` - ${item.episodeTitle}` : ""}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-200">Available</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function episodeStatusLabel(status: RequestMonitor["seasons"][number]["episodes"][number]["status"]) {
  if (status === "available") return "Available";
  if (status === "downloading") return "Downloading";
  if (status === "missing_monitored") return "Missing";
  return "Not Monitored";
}

function episodeStatusClass(status: RequestMonitor["seasons"][number]["episodes"][number]["status"]) {
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

function ReplacementPanel({
  replacement,
  onGrab
}: {
  replacement: { item: MediaLibraryItem; releases: Release[] };
  onGrab: (id: string, release: Release) => void;
}) {
  return (
    <div className="rounded-xl border bg-background/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div>
          <h3 className="text-sm font-semibold">Manual replacement candidates</h3>
          <p className="text-xs text-muted-foreground">Replacing {replacement.item.title}</p>
        </div>
        <Badge>{replacement.releases.length} found</Badge>
      </div>
      <div className="max-h-80 overflow-auto">
        {replacement.releases.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No candidates found.</p>
        ) : (
          <table className="min-w-[760px] w-full text-left text-sm">
            <tbody>
              {replacement.releases.slice(0, 20).map((release) => (
                <tr key={release.guid || release.title} className="border-b last:border-0">
                  <td className="p-3 font-medium">{release.title}</td>
                  <td className="p-3"><Badge>{release.resolution ?? "unknown"}</Badge></td>
                  <td className="p-3 text-muted-foreground">{formatBytes(release.size ?? 0)}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" title="Replace with this release" onClick={() => onGrab(replacement.item.id, release)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
