import { useQuery } from "@tanstack/react-query";
import { Copy, File, Folder, RefreshCw, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ToastProvider";
import { useRefreshMutation } from "../hooks/useRefreshMutation";
import { apiUrl } from "../config";

export function VfsBrowser() {
  const [path, setPath] = useState("/");
  const { notify } = useToast();
  const nodes = useQuery({ queryKey: ["vfs", path], queryFn: () => api.vfsList(path) });
  const streams = useQuery({ queryKey: ["vfs", "streams"], queryFn: api.streamSessions, refetchInterval: 10000 });
  const metrics = useQuery({ queryKey: ["vfs", "streams", "metrics"], queryFn: api.streamMetrics, refetchInterval: 10000 });
  const fuse = useQuery({ queryKey: ["vfs", "fuse"], queryFn: api.fuseStatus, refetchInterval: 15000 });
  const bandwidth = useQuery({ queryKey: ["vfs", "bandwidth"], queryFn: api.bandwidthStatus, refetchInterval: 15000 });
  const refresh = useRefreshMutation(() => api.refreshVfs(), [["vfs", path]], { success: "VFS refreshed." });
  const stopStream = useRefreshMutation((id: string) => api.stopStream(id), [["vfs", "streams"], ["vfs", "streams", "metrics"], ["vfs", "bandwidth"]], { success: "Stream stopped." });
  const crumbs = useMemo(() => path.split("/").filter(Boolean), [path]);
  const folderNodes = useMemo(() => (nodes.data ?? []).filter((node) => isFolderLike(node.type)), [nodes.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">VFS Browser</h1>
          <div className="mt-2 flex flex-wrap gap-1 text-sm text-muted-foreground">
            <button onClick={() => setPath("/")}>root</button>
            {crumbs.map((crumb, index) => {
              const next = `/${crumbs.slice(0, index + 1).join("/")}`;
              return <button key={next} onClick={() => setPath(next)}>/ {crumb}</button>;
            })}
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => refresh.mutate(undefined)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border bg-card p-3">
          <h2 className="mb-2 text-sm font-semibold">This folder</h2>
          <p className="mb-3 text-xs text-muted-foreground">Fast view only. No recursive scan.</p>
          <div className="space-y-1">
            {parentPath(path) ? (
              <button className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => setPath(parentPath(path) ?? "/")}>
                <Folder className="h-4 w-4 text-primary" />
                ..
              </button>
            ) : null}
            {folderNodes.map((node) => (
              <button key={node.path} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted ${node.path === path ? "bg-muted" : ""}`} onClick={() => setPath(node.path)}>
                <Folder className="h-4 w-4 text-primary" />
                <span className="truncate">{node.name}</span>
              </button>
            ))}
            {folderNodes.length === 0 ? <p className="text-sm text-muted-foreground">No subfolders here.</p> : null}
          </div>
        </div>
        <div>
          {nodes.isLoading && <LoadingState />}
          {nodes.isError && <ErrorState message="Could not list VFS path." />}
          {nodes.data && nodes.data.length === 0 && <EmptyState message="This folder is empty." />}
          {nodes.data && nodes.data.length > 0 && (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="min-w-[700px] w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Size</th><th className="p-3 text-right">Actions</th></tr></thead>
                <tbody>
                  {parentPath(path) ? (
                    <tr className="border-b">
                      <td className="p-3">
                        <button className="flex items-center gap-2 font-medium" onClick={() => setPath(parentPath(path) ?? "/")}>
                          <Folder className="h-4 w-4 text-primary" />
                          ..
                        </button>
                      </td>
                      <td className="p-3"><Badge>folder</Badge></td>
                      <td className="p-3 text-muted-foreground">-</td>
                      <td className="p-3 text-muted-foreground">-</td>
                      <td className="p-3 text-right" />
                    </tr>
                  ) : null}
                  {nodes.data.map((node) => (
                    <tr key={node.path} className="border-b last:border-0">
                      <td className="p-3">
                        <button className="flex items-center gap-2 font-medium" onClick={() => isFolderLike(node.type) && setPath(node.path)}>
                          {isFolderLike(node.type) ? <Folder className="h-4 w-4 text-primary" /> : <File className="h-4 w-4 text-muted-foreground" />}
                          {node.name}
                        </button>
                      </td>
                      <td className="p-3"><Badge>{node.type}</Badge></td>
                      <td className="p-3"><Badge>{node.status ?? (node.type === "archive-file" ? "requires_extract" : "ready")}</Badge></td>
                      <td className="p-3 text-muted-foreground">{node.type === "folder" ? "-" : formatBytes(node.size)}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" title="Copy VFS path" onClick={() => navigator.clipboard?.writeText(node.path).then(() => notify("VFS path copied.", "success"))}><Copy className="h-4 w-4" /></Button>
                        {!isFolderLike(node.type) && node.type !== "archive-file" && <Button variant="outline" asChild><a href={apiUrl(`/api/vfs/stream?path=${encodeURIComponent(node.path)}`)}>Open</a></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">FUSE mount</h2>
          <p className="text-sm text-muted-foreground">{fuse.data?.mounted ? "Mounted" : fuse.data?.enabled ? "Enabled, not mounted" : "Disabled"} at {fuse.data?.path ?? "/fuse"}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Bandwidth</h2>
          <p className="text-sm text-muted-foreground">{bandwidth.data?.allocation.streaming ?? 0} stream / {bandwidth.data?.allocation.downloads ?? 0} download connections</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Visible items</h2>
          <p className="text-sm text-muted-foreground">{nodes.data?.length ?? 0} entries loaded for this folder.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Active streams</h2>
          <p className="text-sm text-muted-foreground">{streams.data?.length ?? 0} current stream sessions.</p>
        </div>
      </section>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Active streams</h2>
        </div>
        {streams.data && streams.data.length > 0 ? (
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr><th className="p-3">Path</th><th className="p-3">Status</th><th className="p-3">Source</th><th className="p-3">Range</th><th className="p-3">Sent</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {streams.data.map((stream) => (
                <tr key={stream.id} className="border-b last:border-0">
                  <td className="max-w-xl truncate p-3 font-medium">{stream.path}</td>
                  <td className="p-3"><Badge>{stream.status}</Badge></td>
                  <td className="p-3 text-muted-foreground">{stream.source ?? "fuse"}</td>
                  <td className="p-3 text-muted-foreground">{stream.range || `${stream.start}-${stream.end}`}</td>
                  <td className="p-3 text-muted-foreground">{formatBytes(stream.bytesSent)}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" title="Stop stream" onClick={() => stopStream.mutate(stream.id)}><Square className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-3 text-sm text-muted-foreground">No mounted NZB streams are active.</p>}
        {metrics.data ? (
          <div className="grid gap-3 border-t p-3 text-sm md:grid-cols-4">
            <p className="text-muted-foreground">Served {formatBytes(metrics.data.bytesServed)}</p>
            <p className="text-muted-foreground">Cache {metrics.data.memoryCacheHits + metrics.data.cacheHits} hits / {metrics.data.cacheMisses} misses</p>
            <p className="text-muted-foreground">Read-ahead {formatBytes(metrics.data.readAheadBytes)}</p>
            <p className="text-muted-foreground">Deduped {metrics.data.dedupedSegmentFetches} fetches</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isFolderLike(type: string) {
  return type === "folder" || type === "virtual-release";
}

function parentPath(path: string) {
  if (path === "/") return null;
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : "/";
}

function formatBytes(value: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
