import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type ReleaseCalendarEntry } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

const typeStyles: Record<ReleaseCalendarEntry["type"], string> = {
  movie: "border-cyan-400/30 bg-cyan-500/15 text-cyan-100",
  show: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  episode: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-100"
};

export function ReleaseCalendarPage() {
  const [month, setMonth] = useState(currentMonthKey());
  const [filters, setFilters] = useState<Record<ReleaseCalendarEntry["type"], boolean>>({
    movie: true,
    show: true,
    episode: true
  });
  const [selected, setSelected] = useState<ReleaseCalendarEntry | null>(null);

  const calendar = useQuery({
    queryKey: ["release-calendar", month],
    queryFn: () => api.releaseCalendar(month),
    staleTime: 10 * 60 * 1000
  });

  const visibleEntries = useMemo(
    () => (calendar.data?.entries ?? []).filter((entry) => filters[entry.type]),
    [calendar.data?.entries, filters]
  );
  const gridDays = useMemo(() => buildMonthGrid(month, visibleEntries), [month, visibleEntries]);

  if (calendar.isLoading) return <LoadingState />;
  if (calendar.isError) return <ErrorState message="Could not load release calendar." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Release Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upcoming and already released movies, shows, and episodes in a monthly view.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-36 rounded-xl border bg-card px-4 py-2 text-center text-sm font-semibold">
            {monthLabel(month)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="flex flex-wrap gap-2 rounded-2xl border bg-card p-4">
        {(["movie", "show", "episode"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilters((current) => ({ ...current, [type]: !current[type] }))}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${filters[type] ? typeStyles[type] : "border-white/10 bg-background text-muted-foreground"}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${filters[type] ? "bg-current" : "bg-muted-foreground/60"}`} />
            {type === "movie" ? "Movies" : type === "show" ? "TV Shows" : "Episodes"}
          </button>
        ))}
      </section>

      {visibleEntries.length === 0 ? (
        <EmptyState message="No releases found for this month and filter selection." />
      ) : (
        <section className="overflow-hidden rounded-3xl border bg-card">
          <div className="min-w-0">
            <div className="grid grid-cols-7 border-b bg-background/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="px-1.5 py-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:px-3 sm:text-xs sm:tracking-[0.2em]">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDays.map((day) => (
                <CalendarCell key={day.date} day={day} onSelect={setSelected} />
              ))}
            </div>
          </div>
        </section>
      )}

      {selected ? <EntryModal entry={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function CalendarCell({
  day,
  onSelect
}: {
  day: { date: string; dayNumber: number; inMonth: boolean; isToday: boolean; entries: ReleaseCalendarEntry[] };
  onSelect: (entry: ReleaseCalendarEntry) => void;
}) {
  return (
    <div className={`min-h-32 border-b border-r p-1.5 align-top sm:min-h-40 sm:p-2 ${day.inMonth ? "" : "bg-background/35 text-muted-foreground"} ${day.isToday ? "bg-primary/10 ring-1 ring-inset ring-primary/50" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className={`text-sm font-bold ${day.inMonth ? "" : "opacity-55"} ${day.isToday ? "rounded-full bg-primary px-2 py-0.5 text-primary-foreground" : ""}`}>{day.dayNumber}</span>
        {day.entries.length > 0 ? <span className="text-[11px] text-muted-foreground">{day.entries.length}</span> : null}
      </div>
      <div className="space-y-1.5">
        {day.entries.slice(0, 4).map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry)}
            className={`block w-full rounded-lg border px-1.5 py-1 text-left text-[10px] leading-tight transition hover:brightness-110 sm:px-2 sm:text-[11px] ${typeStyles[entry.type]}`}
          >
            <div className="truncate font-bold">{calendarTitle(entry)}</div>
            <div className="truncate opacity-80">{entry.type === "episode" && entry.seriesTitle ? entry.seriesTitle : typeLabel(entry.type)}</div>
          </button>
        ))}
        {day.entries.length > 4 ? (
          <div className="px-1 text-[11px] font-semibold text-muted-foreground">+{day.entries.length - 4} more</div>
        ) : null}
      </div>
    </div>
  );
}

function EntryModal({ entry, onClose }: { entry: ReleaseCalendarEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge className={typeStyles[entry.type]}>{typeLabel(entry.type)}</Badge>
            <h2 className="text-2xl font-bold">{calendarTitle(entry)}</h2>
            <p className="text-sm text-muted-foreground">{formatLongDate(entry.releaseDate)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoLine label="Type" value={typeLabel(entry.type)} />
          <InfoLine label="Title" value={entry.seriesTitle ?? entry.title} />
          {entry.seasonNumber ? <InfoLine label="Season" value={String(entry.seasonNumber).padStart(2, "0")} /> : null}
          {entry.episodeNumber ? <InfoLine label="Episode" value={String(entry.episodeNumber).padStart(2, "0")} /> : null}
        </div>

        {entry.overview ? <p className="mt-4 text-sm text-muted-foreground">{entry.overview}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button asChild>
            <Link to={detailsHref(entry)}>Open Details</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function buildMonthGrid(month: string, entries: ReleaseCalendarEntry[]) {
  const { year, monthIndex } = parseMonth(month);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const last = new Date(Date.UTC(year, monthIndex, 0));
  const firstDay = first.getUTCDay();
  const gridStart = new Date(Date.UTC(year, monthIndex - 1, 1 - firstDay));
  const entryMap = new Map<string, ReleaseCalendarEntry[]>();
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const entry of entries) {
    const rows = entryMap.get(entry.releaseDate) ?? [];
    rows.push(entry);
    entryMap.set(entry.releaseDate, rows);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      inMonth: date <= last && date >= first,
      isToday: iso === todayIso,
      entries: (entryMap.get(iso) ?? []).sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
    };
  });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const { year, monthIndex } = parseMonth(month);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const { year, monthIndex } = parseMonth(month);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function typeLabel(type: ReleaseCalendarEntry["type"]) {
  return type === "movie" ? "Movie" : type === "show" ? "TV Show" : "Episode";
}

function calendarTitle(entry: ReleaseCalendarEntry) {
  if (entry.type === "episode" && entry.seasonNumber && entry.episodeNumber) {
    return `${entry.seriesTitle ?? entry.title} S${String(entry.seasonNumber).padStart(2, "0")}E${String(entry.episodeNumber).padStart(2, "0")}`;
  }
  return entry.title;
}

function detailsHref(entry: ReleaseCalendarEntry) {
  const params = new URLSearchParams({
    mediaType: entry.mediaType,
    title: entry.seriesTitle ?? entry.title
  });
  if (entry.year) params.set("year", String(entry.year));
  if (entry.tmdbId) params.set("tmdbId", entry.tmdbId);
  if (entry.tvdbId) params.set("tvdbId", entry.tvdbId);
  if (entry.imdbId) params.set("imdbId", entry.imdbId);
  if (entry.overview) params.set("overview", entry.overview);
  return `/details?${params.toString()}`;
}

function parseMonth(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  return {
    year: match ? Number(match[1]) : now.getUTCFullYear(),
    monthIndex: match ? Number(match[2]) : now.getUTCMonth() + 1
  };
}
