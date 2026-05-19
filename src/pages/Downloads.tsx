import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Pause, Play, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { api, type Download as DownloadType } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useRefreshMutation } from "../hooks/useRefreshMutation";
import { useToast } from "../components/ToastProvider";

export function Downloads() {
  const { notify } = useToast();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [url, setUrl] = useState("");
  const [urlTestResult, setUrlTestResult] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const queue = useQuery({ queryKey: ["downloads", "queue"], queryFn: api.queue, refetchInterval: 5000, refetchOnWindowFocus: false });
  const history = useQuery({ queryKey: ["downloads", "history"], queryFn: api.history, refetchInterval: 20000, refetchOnWindowFocus: false });
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

  const active = tab === "queue" ? queue.data : history.data;
  const loading = tab === "queue" ? queue.isLoading : history.isLoading;
  const errored = tab === "queue" ? queue.isError : history.isError;

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
            <FileCheck2 className="mr-2 h-4 w-4" />Test
          </Button>
          <Button onClick={() => { notify("Adding NZB URL to queue...", "info"); addUrl.mutate(url); setUrl(""); }} disabled={!url || addUrl.isPending}>{addUrl.isPending ? "Adding..." : "Add"}</Button>
          <Button asChild variant="outline">
            <label>
              <Upload className="mr-2 h-4 w-4" />NZB
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

      <div className="flex gap-2">
        {(["queue", "history"] as const).map((item) => (
          <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>
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
      </div>

      {loading && <LoadingState />}
      {errored && <ErrorState message="Could not load download data." />}
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

function DownloadRow({ download, onPause, onResume, onCancel, onRetry, onMakeAvailable, onDelete }: { download: DownloadType; onPause: (id: string) => void; onResume: (id: string) => void; onCancel: (id: string) => void; onRetry: (id: string) => void; onMakeAvailable: (id: string) => void; onDelete: (id: string) => void }) {
  const pct = Math.max(0, Math.min(100, download.progress || (download.size ? (download.downloaded / download.size) * 100 : 0)));
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
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{download.statusLabel ?? statusText(download.status)}</span>
        <span>{pct.toFixed(pct < 10 ? 1 : 0)}% · {formatBytes(download.downloaded)} / {formatBytes(download.size)} · {formatBytes(download.speedBytesSec)}/s · {download.etaSeconds ?? "-"}s ETA</span>
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
