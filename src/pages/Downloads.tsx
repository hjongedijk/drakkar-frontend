import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Pause, Play, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Download as DownloadType } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useRefreshMutation } from "../hooks/useRefreshMutation";
import { useToast } from "../components/ToastProvider";

export function Downloads() {
  const { notify } = useToast();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [queuePage, setQueuePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState<50 | 100 | "all">(50);
  const [historyPageSize, setHistoryPageSize] = useState<50 | 100 | "all">(50);
  const [url, setUrl] = useState("");
  const [urlTestResult, setUrlTestResult] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const queueSummary = useQuery({ queryKey: ["downloads", "queue"], queryFn: api.queue, refetchInterval: 1000, refetchOnWindowFocus: false });
  const queue = useQuery({
    queryKey: ["downloads", "queue", queuePage, queuePageSize],
    queryFn: () => queuePageSize === "all"
      ? api.queue().then((items) => ({ items, page: 1, totalPages: 1, total: items.length, limit: items.length }))
      : api.queuePage(queuePage, queuePageSize),
    refetchInterval: 1000,
    refetchOnWindowFocus: false
  });
  const history = useQuery({
    queryKey: ["downloads", "history", historyPage, historyPageSize],
    queryFn: () => historyPageSize === "all"
      ? api.history().then((items) => ({ items, page: 1, totalPages: 1, total: items.length, limit: items.length }))
      : api.historyPage(historyPage, historyPageSize),
    refetchInterval: 20000,
    refetchOnWindowFocus: false
  });
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 2000, refetchOnWindowFocus: false });
  const streamMetrics = useQuery({ queryKey: ["streams", "metrics"], queryFn: api.streamMetrics, refetchInterval: 1000, refetchOnWindowFocus: false });
  const addUrl = useRefreshMutation((value: string) => api.addUrl(value), [["downloads", "queue"]], { success: "NZB URL queued" });
  const testUrl = useRefreshMutation((value: string) => api.testNzbUrl(value), []);
  const addNzb = useRefreshMutation((file: File) => addNzbFile(file), [["downloads", "queue"]], { success: "NZB file queued" });
  const pause = useRefreshMutation((id: string) => api.pause(id), [["downloads", "queue"]], { success: "Download paused" });
  const resume = useRefreshMutation((id: string) => api.resume(id), [["downloads", "queue"]], { success: "Download queued" });
  const cancel = useRefreshMutation((id: string) => api.cancel(id), [["downloads", "queue"], ["downloads", "history"]], { success: "Download cancelled" });
  const retry = useRefreshMutation((id: string) => api.retry(id), [["downloads", "queue"]], { success: "Retry queued" });
  const makeAvailable = useRefreshMutation((id: string) => api.makeAvailable(id), [["downloads", "queue"], ["downloads", "history"], ["library"]], { success: "Library link created" });
  const remove = useRefreshMutation((id: string) => api.deleteDownload(id), [["downloads", "queue"], ["downloads", "history"]], { success: "Download deleted" });
  const cleanupHistory = useRefreshMutation(() => api.cleanupHistory(), [["downloads", "history"]], { success: "Download history cleaned up" });

  const activePage = tab === "queue" ? queue.data : history.data;
  const active = activePage?.items;
  const loading = tab === "queue" ? queue.isLoading : history.isLoading;
  const errored = tab === "queue" ? queue.isError : history.isError;
  const totalSpeedBytes = useMemo(
    () => (queueSummary.data ?? []).reduce((sum, download) => sum + Math.max(0, download.speedBytesSec || 0), 0),
    [queueSummary.data]
  );
  const [streamSpeedBytes, setStreamSpeedBytes] = useState(0);
  const streamSpeedRef = useRef<{ bytes: number; at: number } | null>(null);
  useEffect(() => {
    const bytes = streamMetrics.data?.bytesServed;
    if (bytes == null) return;
    const now = Date.now();
    const previous = streamSpeedRef.current;
    streamSpeedRef.current = { bytes, at: now };
    if (!previous || now <= previous.at || bytes < previous.bytes) return;
    setStreamSpeedBytes((bytes - previous.bytes) / ((now - previous.at) / 1000));
  }, [streamMetrics.data?.bytesServed]);
  const combinedSpeedBytes = totalSpeedBytes + streamSpeedBytes;
  const fastestDownload = useMemo(
    () => [...(queueSummary.data ?? [])].sort((a, b) => (b.speedBytesSec || 0) - (a.speedBytesSec || 0))[0],
    [queueSummary.data]
  );
  const activeJobCount = useMemo(
    () => (queueSummary.data ?? []).filter((download) => ["downloading", "verifying", "prepared", "fetching_nzb"].includes(download.status)).length,
    [queueSummary.data]
  );
  const peakSpeedRef = useRef(0);
  useEffect(() => {
    peakSpeedRef.current = Math.max(peakSpeedRef.current, combinedSpeedBytes);
  }, [combinedSpeedBytes]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Downloads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Queue, history, failed jobs, and repair actions.</p>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:w-auto sm:grid-flow-col">
          <Input className="w-full sm:w-72" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="NZB URL" />
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => {
              notify("Testing NZB URL...", "info");
              testUrl.mutate(url, {
                onSuccess: (result) =>
                  setUrlTestResult(
                    result.ok
                      ? `NZB OK: ${result.fileCount} files, ${result.segmentCount} segments, saved ${formatBytes(result.bytes)}.`
                      : `Downloaded but invalid: ${result.errors.join(", ")}`
                  ),
                onError: (error) => setUrlTestResult(error instanceof Error ? error.message : "NZB test failed")
              });
            }}
            disabled={!url}
          >
            <FileCheck2 className="h-4 w-4 sm:mr-2" /><span className="sr-only sm:not-sr-only">Test</span>
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => { notify("Adding NZB URL to queue...", "info"); addUrl.mutate(url); setUrl(""); }} disabled={!url || addUrl.isPending}>{addUrl.isPending ? "Adding..." : "Add"}</Button>
          <Button className="w-full sm:w-auto" asChild variant="outline">
            <label>
              <Upload className="h-4 w-4 sm:mr-2" /><span className="sr-only sm:not-sr-only">NZB</span>
              <input
                className="hidden"
                type="file"
                accept=".nzb,application/x-nzb,application/xml,text/xml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setUploadStatus(`Uploading ${file.name}...`);
                    notify(`Uploading ${file.name}...`, "info");
                    addNzb.mutate(file, {
                      onSuccess: () => setUploadStatus(`${file.name} queued for verification.`),
                      onError: (error) => setUploadStatus(error instanceof Error ? error.message : "NZB upload failed")
                    });
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {urlTestResult ? <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">{urlTestResult}</div> : null}
      {uploadStatus ? <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">{uploadStatus}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current Throughput"
          value={`${formatBytes(combinedSpeedBytes)}/s`}
          detail={`Downloads ${formatBytes(totalSpeedBytes)}/s · Streams ${formatBytes(streamSpeedBytes)}/s`}
        />
        <MetricCard
          label="Session Peak"
          value={`${formatBytes(peakSpeedRef.current)}/s`}
          detail="Highest total speed seen since opening this page"
        />
        <MetricCard
          label="Active Queue Jobs"
          value={String(activeJobCount)}
          detail={fastestDownload ? `Fastest: ${fastestDownload.title}` : "No active download speed yet"}
        />
        <MetricCard
          label="Connection Budget"
          value={`${status.data?.bandwidth?.allocation.downloads ?? 0} download / ${status.data?.bandwidth?.policy.maxTotalUsenetConnections ?? 0} total`}
          detail={status.data?.bandwidth?.activeStreamCount
            ? `${status.data.bandwidth.activeStreamCount} active stream(s) sharing bandwidth`
            : "All idle streaming capacity can be used by downloads"}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {(["queue", "history"] as const).map((item) => (
          <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>
            {item} {item === "queue" ? `(${queue.data?.total ?? queueSummary.data?.length ?? 0})` : `(${history.data?.total ?? 0})`}
          </Button>
        ))}
        {tab === "history" ? (
          <Button
            variant="outline"
            onClick={() => {
              notify("Cleaning failed download history...", "info");
              cleanupHistory.mutate(undefined);
            }}
            disabled={cleanupHistory.isPending}
          >
            Clean up failed
          </Button>
        ) : null}
        <Select
          className="w-36"
          value={String(tab === "queue" ? queuePageSize : historyPageSize)}
          onChange={(event) => {
            const value = event.target.value === "all" ? "all" : Number(event.target.value) as 50 | 100;
            if (tab === "queue") {
              setQueuePage(1);
              setQueuePageSize(value);
            } else {
              setHistoryPage(1);
              setHistoryPageSize(value);
            }
          }}
        >
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
          <option value="all">Show all</option>
        </Select>
      </div>

      {loading && <LoadingState />}
      {errored && <ErrorState message="Could not load download data." />}
      {activePage ? (
        <PaginationBar
          page={activePage.page}
          totalPages={activePage.totalPages}
          total={activePage.total}
          label={tab === "queue" ? "queue items" : "history items"}
          onPrev={() => tab === "queue" ? setQueuePage((page) => Math.max(1, page - 1)) : setHistoryPage((page) => Math.max(1, page - 1))}
          onNext={() => tab === "queue" ? setQueuePage((page) => Math.min(activePage.totalPages, page + 1)) : setHistoryPage((page) => Math.min(activePage.totalPages, page + 1))}
        />
      ) : null}

      {active && (active.length === 0 ? <EmptyState message="Nothing here yet." /> : (
        <div className="space-y-3">
          {active.map((download) => (
            <DownloadRow
              key={download.id}
              download={download}
              onPause={(id) => { notify("Pausing download...", "info"); pause.mutate(id); }}
              onResume={(id) => { notify("Resuming download...", "info"); resume.mutate(id); }}
              onCancel={(id) => { notify("Cancelling download...", "info"); cancel.mutate(id); }}
              onRetry={(id) => { notify("Retrying download...", "info"); retry.mutate(id); }}
              onMakeAvailable={(id) => { notify("Creating library link...", "info"); makeAvailable.mutate(id); }}
              onDelete={(id) => { notify("Deleting download...", "info"); remove.mutate(id); }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PaginationBar({ page, totalPages, total, label, onPrev, onNext }: { page: number; totalPages: number; total: number; label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <span className="text-muted-foreground">{total} {label} · page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onPrev} disabled={page <= 1}>Previous</Button>
        <Button variant="outline" onClick={onNext} disabled={page >= totalPages}>Next</Button>
      </div>
    </div>
  );
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{detail}</p>
    </div>
  );
}

function DownloadRow({ download, onPause, onResume, onCancel, onRetry, onMakeAvailable, onDelete }: { download: DownloadType; onPause: (id: string) => void; onResume: (id: string) => void; onCancel: (id: string) => void; onRetry: (id: string) => void; onMakeAvailable: (id: string) => void; onDelete: (id: string) => void }) {
  const rawPct = Math.max(0, Math.min(100, download.progress || (download.size ? (download.downloaded / download.size) * 100 : 0)));
  const pct = download.status === "prepared" ? Math.min(99, rawPct) : rawPct;
  const active = ["downloading", "verifying", "fetching_nzb", "prepared"].includes(download.status);
  const progressLabel = download.status === "prepared" ? "finalizing" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium leading-snug">{download.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{download.source}</p>
        </div>
        <div className="flex max-w-full flex-wrap justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onPause(download.id)}><Pause className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onResume(download.id)}><Play className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onRetry(download.id)}><RotateCcw className="h-4 w-4" /></Button>
          {download.status === "prepared" || download.status === "mounted" ? <Button variant="outline" onClick={() => onMakeAvailable(download.id)}>Make available</Button> : null}
          <Button variant="ghost" size="icon" onClick={() => onCancel(download.id)}><X className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(download.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded bg-muted">
        <div
          className={`h-full bg-primary transition-all ${active && pct < 1 ? "animate-pulse" : ""}`}
          style={{ width: active && pct < 1 ? "3rem" : `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:justify-between sm:gap-2">
        <span>{download.statusLabel ?? statusText(download.status)}</span>
        <span className="break-words">{progressLabel} · {formatBytes(download.downloaded)} / {formatBytes(download.size)} · {formatBytes(download.speedBytesSec)}/s · {download.etaSeconds ?? "-"}s ETA</span>
      </div>
      {download.error ? <p className="mt-2 text-xs text-destructive">{download.error}</p> : null}
    </div>
  );
}

async function addNzbFile(file: File) {
  return api.addNzb({ filename: file.name, title: file.name.replace(/\.nzb$/i, ""), content: await file.text() });
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    queued: "Queued for preparation",
    fetching_nzb: "Fetching NZB",
    verifying: "Verifying Usenet articles",
    prepared: "Prepared, ready to link",
    available: "Available in library",
    waiting_for_provider: "Waiting for provider",
    failed: "Failed",
    cancelled: "Cancelled",
    paused: "Paused"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}
