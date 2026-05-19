import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Download } from "../api/client";
import { useToast } from "../components/ToastProvider";

function messageFor(download: Download) {
  const title = shortMediaLabel(download.title);
  if (download.status === "queued") return `${title} queued.`;
  if (download.status === "verifying") return `${title} validating release.`;
  if (download.status === "prepared") return `${title} validated and ready.`;
  if (download.status === "available") return `Added to library: ${title}`;
  if (download.status === "waiting_for_provider") return `${title} waiting for Usenet provider capacity.`;
  if (download.status === "failed") return `${title} failed: ${download.error ?? "unknown error"}`;
  return null;
}

function shortMediaLabel(value: string, max = 48) {
  const clean = value.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  const episodeMatch = clean.match(/^(.*?)[\s-]+S(\d{1,2})E(\d{1,3})\b/i);
  if (episodeMatch) {
    const [, rawTitle = "", season = "", episode = ""] = episodeMatch;
    const title = tidyTitle(rawTitle);
    return `${truncate(title, max)} (S${season.padStart(2, "0")}E${episode.padStart(2, "0")})`;
  }
  const seasonMatch = clean.match(/^(.*?)[\s-]+S(\d{1,2})\b(?!E\d)/i);
  if (seasonMatch) {
    const [, rawTitle = "", season = ""] = seasonMatch;
    const title = tidyTitle(rawTitle);
    return `${truncate(title, max)} (Season ${season.padStart(2, "0")})`;
  }
  const yearMatch = clean.match(/^(.*?)[\s(]+(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const title = tidyTitle(yearMatch[1] ?? "");
    return `${truncate(title, max)} (${yearMatch[2]})`;
  }
  return truncate(tidyTitle(clean), max);
}

function tidyTitle(value: string) {
  return value.replace(/[-_.]+$/g, "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function toneFor(status: string) {
  if (status === "available" || status === "prepared" || status === "queued") return "success" as const;
  if (status === "failed") return "error" as const;
  return "info" as const;
}

export function useDownloadToasts() {
  const { notify } = useToast();
  const seen = useRef(new Map<string, string>());
  const queue = useQuery({ queryKey: ["downloads", "queue", "toast-watch"], queryFn: api.queue, refetchInterval: 8000 });
  const history = useQuery({ queryKey: ["downloads", "history", "toast-watch"], queryFn: api.history, refetchInterval: 15000 });

  useEffect(() => {
    const downloads = [...(queue.data ?? []), ...(history.data ?? [])];
    for (const download of downloads) {
      const previous = seen.current.get(download.id);
      if (!previous) {
        seen.current.set(download.id, download.status);
        continue;
      }
      if (previous === download.status) continue;
      seen.current.set(download.id, download.status);
      const message = messageFor(download);
      if (message) notify(message, toneFor(download.status));
    }
  }, [history.data, notify, queue.data]);
}
