import { useQuery } from "@tanstack/react-query";
import { Captions, Play, Search, Tv, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type MediaLibraryItem, type VfsNode } from "../api/client";
import { apiAssetUrl } from "../config";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";

type WatchGroup = {
  key: string;
  title: string;
  mediaType: "movie" | "tv";
  posterUrl?: string | null;
  year?: number | null;
  items: MediaLibraryItem[];
};

type PlaybackMode = "direct" | "compatible";

export function WatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const library = useQuery({ queryKey: ["library"], queryFn: api.library, refetchInterval: 120000 });
  const availableItems = useMemo(
    () => (library.data ?? []).filter((item) => item.libraryStatus === "available" && item.filePath?.startsWith("/mounted/")),
    [library.data]
  );
  const groups = useMemo(() => buildWatchGroups(availableItems), [availableItems]);
  const filteredGroups = useMemo(
    () => groups.filter((group) => !query || `${group.title} ${group.year ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [groups, query]
  );

  const activeGroupKey = searchParams.get("group");
  const activeItemId = searchParams.get("item");
  const activeGroup = groups.find((group) => group.key === activeGroupKey) ?? filteredGroups[0] ?? groups[0];
  const activeItem = activeGroup?.items.find((item) => item.id === activeItemId) ?? activeGroup?.items[0];

  useEffect(() => {
    if (!activeGroup || !activeItem) return;
    if (activeGroupKey === activeGroup.key && activeItemId === activeItem.id) return;
    setSearchParams({ group: activeGroup.key, item: activeItem.id }, { replace: true });
  }, [activeGroup, activeGroupKey, activeItem, activeItemId, setSearchParams]);

  if (library.isLoading) return <LoadingState />;
  if (library.isError) return <ErrorState message="Could not load watch library." />;
  if (groups.length === 0 || !activeGroup || !activeItem) return <EmptyState message="No mounted playable items available yet." />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_260px_260px]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Search Library</span>
            <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-background/60 px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search movies or shows..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Title</span>
            <select
              className="h-12 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none"
              value={activeGroup.key}
              onChange={(event) => {
                const next = groups.find((group) => group.key === event.target.value);
                if (next) setSearchParams({ group: next.key, item: next.items[0]!.id });
              }}
            >
              {filteredGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.title}{group.year ? ` (${group.year})` : ""}{group.mediaType === "tv" ? ` · ${group.items.length} eps` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{activeGroup.mediaType === "tv" ? "Episode" : "Playback"}</span>
            {activeGroup.mediaType === "tv" ? (
              <select
                className="h-12 w-full rounded-xl border border-white/10 bg-background/60 px-4 text-sm outline-none"
                value={activeItem.id}
                onChange={(event) => setSearchParams({ group: activeGroup.key, item: event.target.value })}
              >
                {activeGroup.items
                  .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      S{String(item.season ?? 0).padStart(2, "0")}E{String(item.episode ?? 0).padStart(2, "0")} {item.episodeTitle ? `· ${item.episodeTitle}` : ""}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="flex h-12 items-center rounded-xl border border-white/10 bg-background/60 px-4 text-sm text-muted-foreground">
                Browser-compatible playback with sound
              </div>
            )}
          </label>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border bg-card p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-20 w-14 shrink-0 place-items-center overflow-hidden rounded bg-muted">
              {activeGroup.posterUrl ? <img src={activeGroup.posterUrl} alt="" className="h-full w-full object-cover" /> : <Tv className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{activeGroup.title}</h1>
              <p className="text-sm text-muted-foreground">{activeGroup.mediaType === "tv" ? `${activeGroup.items.length} episodes ready` : activeGroup.year ?? "Movie ready"}</p>
            </div>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {filteredGroups.map((group) => (
              <button
                key={group.key}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${group.key === activeGroup.key ? "border-primary bg-primary/10" : "border-white/10 bg-background/40 hover:bg-white/5"}`}
                onClick={() => setSearchParams({ group: group.key, item: group.items[0]!.id })}
              >
                <div className="grid h-16 w-11 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                  {group.posterUrl ? <img src={group.posterUrl} alt="" className="h-full w-full object-cover" /> : <Play className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{group.title}</div>
                  <div className="text-xs text-muted-foreground">{group.mediaType === "tv" ? `${group.items.length} episodes` : group.year ?? "movie"}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold">{activeGroup.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeItem.season != null && activeItem.episode != null ? `S${String(activeItem.season).padStart(2, "0")}E${String(activeItem.episode).padStart(2, "0")}` : "Movie"}
              {activeItem.episodeTitle ? ` · ${activeItem.episodeTitle}` : ""}
            </p>
          </div>
          <WebPlayer item={activeItem} />
        </div>
      </div>
    </div>
  );
}

function buildWatchGroups(items: MediaLibraryItem[]): WatchGroup[] {
  const groups = new Map<string, WatchGroup>();
  for (const item of items) {
    const key = item.imdbId ? `${item.mediaType}:imdb:${item.imdbId}` : item.tmdbId ? `${item.mediaType}:tmdb:${item.tmdbId}` : item.tvdbId ? `${item.mediaType}:tvdb:${item.tvdbId}` : `${item.mediaType}:${item.title}:${item.year ?? ""}`;
    const group = groups.get(key) ?? {
      key,
      title: item.title,
      mediaType: item.mediaType as "movie" | "tv",
      posterUrl: item.posterUrl,
      year: item.year,
      items: []
    };
    group.posterUrl ??= item.posterUrl;
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

function WebPlayer({ item }: { item: MediaLibraryItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [textTracks, setTextTracks] = useState<Array<{ id: string; label: string; mode: TextTrackMode }>>([]);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("direct");
  const [subtitleScanEnabled, setSubtitleScanEnabled] = useState(false);
  const originalStreamUrl = apiAssetUrl(`/api/vfs/stream?path=${encodeURIComponent(item.filePath ?? "")}`);
  const playUrl = playbackMode === "direct" ? originalStreamUrl : apiAssetUrl(`/api/vfs/play?path=${encodeURIComponent(item.filePath ?? "")}`);
  const subtitleFiles = useQuery({
    queryKey: ["vfs", "subtitles", item.filePath],
    enabled: Boolean(item.filePath) && subtitleScanEnabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const folder = item.filePath?.slice(0, item.filePath.lastIndexOf("/")) || "/";
      return (await api.vfsList(folder)).filter(isBrowserSubtitle);
    }
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const refreshTracks = () => {
      setTextTracks(Array.from(video.textTracks).map((track, index) => ({
        id: String(index),
        label: track.label || track.language || `Subtitle ${index + 1}`,
        mode: track.mode
      })));
    };
    video.addEventListener("loadedmetadata", refreshTracks);
    video.addEventListener("loadeddata", refreshTracks);
    refreshTracks();
    return () => {
      video.removeEventListener("loadedmetadata", refreshTracks);
      video.removeEventListener("loadeddata", refreshTracks);
    };
  }, [item.filePath]);

  useEffect(() => {
    setPlaybackError(null);
    setPlaybackMode("direct");
    setSubtitleScanEnabled(false);
  }, [item.id, item.filePath]);

  const selectTextTrack = (id: string) => {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    Array.from(tracks).forEach((track, index) => {
      track.mode = String(index) === id ? "showing" : "disabled";
    });
    setTextTracks(Array.from(tracks).map((track, index) => ({ id: String(index), label: track.label || track.language || `Subtitle ${index + 1}`, mode: track.mode })));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/30">
      <video
        ref={videoRef}
        className="aspect-video w-full bg-black"
        controls
        playsInline
        preload="metadata"
        src={playUrl}
        onError={() => {
          if (playbackMode === "direct") {
            setPlaybackMode("compatible");
            return;
          }
          setPlaybackError("Playback failed for this stream. Try the original stream link below while we transcode this source.");
        }}
      >
        {(subtitleFiles.data ?? []).map((subtitle, index) => (
          <track
            key={subtitle.path}
            kind="subtitles"
            src={apiAssetUrl(`/api/vfs/subtitle?path=${encodeURIComponent(subtitle.path)}`)}
            srcLang={subtitleLanguage(subtitle.name)}
            label={subtitleLabel(subtitle.name, index)}
          />
        ))}
      </video>
      <div className="space-y-3 border-t border-white/10 bg-card/95 p-3 text-xs text-muted-foreground">
        {playbackError ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">{playbackError}</div> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 font-semibold ${playbackMode === "direct" ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}
            onClick={() => {
              setPlaybackError(null);
              setPlaybackMode("direct");
            }}
          >
            Direct
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 font-semibold ${playbackMode === "compatible" ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}
            onClick={() => {
              setPlaybackError(null);
              setPlaybackMode("compatible");
            }}
          >
            Compatible
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 font-semibold ${subtitleScanEnabled ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}
            onClick={() => setSubtitleScanEnabled(true)}
          >
            Scan subtitles
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2 font-semibold text-foreground"><Volume2 className="h-4 w-4" />Audio</div>
            <p>{playbackMode === "direct" ? "Direct stream. Lowest CPU, best startup. Browser codec support decides playback." : "Compatible stream. Lower bitrate transcode for browsers that reject source codec/audio."}</p>
          </div>
          <TrackPanel
            icon={<Captions className="h-4 w-4" />}
            title="Subtitles"
            empty={!subtitleScanEnabled ? "Subtitle scan off. Press scan subtitles." : subtitleFiles.isLoading ? "Scanning mounted folder for subtitles..." : "No SRT/VTT subtitles found next to this file."}
            tracks={textTracks.map((track) => ({ id: track.id, label: track.label, active: track.mode === "showing" }))}
            onSelect={selectTextTrack}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{playbackMode === "direct" ? "Use direct when file already browser-friendly." : "Use compatible when browser needs safer codec/audio."}</span>
          <a className="font-semibold text-primary" href={originalStreamUrl} target="_blank" rel="noreferrer">Open original stream</a>
        </div>
      </div>
    </div>
  );
}

function TrackPanel({
  icon,
  title,
  empty,
  tracks,
  onSelect
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  tracks: Array<{ id: string; label: string; active: boolean }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">{icon}{title}</div>
      {tracks.length === 0 ? <p>{empty}</p> : (
        <div className="flex flex-wrap gap-2">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              className={`rounded-full border px-3 py-1 font-semibold ${track.active ? "border-primary bg-primary/20 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"}`}
              onClick={() => onSelect(track.id)}
            >
              {track.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isBrowserSubtitle(node: VfsNode) {
  return /\.(srt|vtt)$/i.test(node.name);
}

function subtitleLanguage(name: string) {
  const match = name.match(/\b(eng|en|dut|nl|nld|de|ger|fr|fre|es|spa)\b/i);
  const value = match?.[1]?.toLowerCase();
  if (!value) return "und";
  if (["dut", "nld"].includes(value)) return "nl";
  if (["ger"].includes(value)) return "de";
  if (["fre"].includes(value)) return "fr";
  if (["spa"].includes(value)) return "es";
  return value === "eng" ? "en" : value;
}

function subtitleLabel(name: string, index: number) {
  const language = subtitleLanguage(name);
  return language === "und" ? `Subtitle ${index + 1}` : language.toUpperCase();
}
