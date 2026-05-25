import { useQuery } from "@tanstack/react-query";
import { Copy, File, FilePlus2, Folder, FolderPlus, Pencil, RefreshCw, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToast } from "../components/ToastProvider";
import { useRefreshMutation } from "../hooks/useRefreshMutation";
import { apiUrl } from "../config";

export function VfsBrowser() {
  const [path, setPath] = useState("/");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [renameTarget, setRenameTarget] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const { notify } = useToast();
  const nodes = useQuery({ queryKey: ["vfs", path], queryFn: () => api.vfsList(path) });
  const selectedText = useQuery({
    queryKey: ["vfs", "text", selectedPath],
    queryFn: () => api.vfsText(selectedPath as string),
    enabled: editorOpen && Boolean(selectedPath)
  });
  const streams = useQuery({ queryKey: ["vfs", "streams"], queryFn: api.streamSessions, refetchInterval: 10000 });
  const metrics = useQuery({ queryKey: ["vfs", "streams", "metrics"], queryFn: api.streamMetrics, refetchInterval: 10000 });
  const fuse = useQuery({ queryKey: ["vfs", "fuse"], queryFn: api.fuseStatus, refetchInterval: 15000 });
  const bandwidth = useQuery({ queryKey: ["vfs", "bandwidth"], queryFn: api.bandwidthStatus, refetchInterval: 15000 });
  const refresh = useRefreshMutation(() => api.refreshVfs(), [["vfs", path]], { success: "VFS refreshed." });
  const createFolder = useRefreshMutation((targetPath: string) => api.createVfsFolder(targetPath), [["vfs", path]], { success: "Folder created." });
  const createFile = useRefreshMutation((targetPath: string) => api.createVfsFile(targetPath), [["vfs", path]], { success: "File created." });
  const saveFile = useRefreshMutation(({ targetPath, content }: { targetPath: string; content: string }) => api.updateVfsFile(targetPath, content), [["vfs", path], ["vfs", "text", selectedPath ?? ""]], { success: "File saved." });
  const renamePath = useRefreshMutation(({ currentPath, nextPath }: { currentPath: string; nextPath: string }) => api.renameVfsPath(currentPath, nextPath), [["vfs", path]], { success: "Path renamed." });
  const deletePath = useRefreshMutation((targetPath: string) => api.deleteVfsPath(targetPath), [["vfs", path]], { success: "Path deleted." });
  const stopStream = useRefreshMutation((id: string) => api.stopStream(id), [["vfs", "streams"], ["vfs", "streams", "metrics"], ["vfs", "bandwidth"]], { success: "Stream stopped." });
  const crumbs = useMemo(() => path.split("/").filter(Boolean), [path]);
  const folderNodes = useMemo(() => (nodes.data ?? []).filter((node) => isFolderLike(node.type)), [nodes.data]);
  const selectedNode = useMemo(() => (nodes.data ?? []).find((node) => node.path === selectedPath) ?? null, [nodes.data, selectedPath]);

  useEffect(() => {
    if (selectedText.data?.content != null) setEditorContent(selectedText.data.content);
  }, [selectedText.data?.content]);

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
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={() => refresh.mutate(undefined)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Create folder</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Season 02" />
            <Button
              className="w-full shrink-0 justify-center whitespace-nowrap px-4"
              onClick={() => {
                if (!newFolderName.trim()) return;
                createFolder.mutate(joinPath(path, newFolderName.trim()));
                setNewFolderName("");
              }}
            >
              <FolderPlus className="mr-2 h-4 w-4" />Create
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Create file</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Input value={newFileName} onChange={(event) => setNewFileName(event.target.value)} placeholder="notes.txt" />
            <Button
              className="w-full shrink-0 justify-center whitespace-nowrap px-4"
              onClick={() => {
                if (!newFileName.trim()) return;
                createFile.mutate(joinPath(path, newFileName.trim()));
                setNewFileName("");
              }}
            >
              <FilePlus2 className="mr-2 h-4 w-4" />Create
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Selected</p>
          <div className="min-h-[76px] rounded-xl border bg-background/50 p-3 text-sm text-muted-foreground">
            {selectedNode ? selectedNode.path : "Pick a file or folder below to rename, edit, or delete it."}
          </div>
        </div>
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
            <>
            <div className="space-y-3 md:hidden">
              {parentPath(path) ? (
                <button className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-3 text-left font-medium" onClick={() => setPath(parentPath(path) ?? "/")}>
                  <Folder className="h-4 w-4 text-primary" />
                  ..
                </button>
              ) : null}
              {nodes.data.map((node) => (
                <div key={node.path} className="rounded-lg border bg-card p-4">
                  <button className="flex w-full items-center gap-2 text-left font-medium" onClick={() => isFolderLike(node.type) ? setPath(node.path) : setSelectedPath(node.path)}>
                    {isFolderLike(node.type) ? <Folder className="h-4 w-4 text-primary" /> : <File className="h-4 w-4 text-muted-foreground" />}
                    <span className="break-words">{node.name}</span>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Badge>{node.type}</Badge>
                    <Badge>{node.status ?? (node.type === "archive-file" ? "requires_extract" : "ready")}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{node.type === "folder" ? "-" : formatBytes(node.size)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="ghost" size="icon" title="Copy VFS path" onClick={() => navigator.clipboard?.writeText(node.path).then(() => notify("VFS path copied.", "success"))}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Rename" onClick={() => { setSelectedPath(node.path); setRenameTarget(node.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!isFolderLike(node.type) ? <Button variant="ghost" size="icon" title="Edit text file" onClick={() => { setSelectedPath(node.path); setEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button> : null}
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (window.confirm(`Delete ${node.name}?`)) deletePath.mutate(node.path); }}><Trash2 className="h-4 w-4" /></Button>
                    {!isFolderLike(node.type) && node.type !== "archive-file" && <Button variant="outline" asChild><a href={apiUrl(`/api/vfs/stream?path=${encodeURIComponent(node.path)}`)}>Open</a></Button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
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
                        <button className="flex items-center gap-2 font-medium" onClick={() => isFolderLike(node.type) ? setPath(node.path) : setSelectedPath(node.path)}>
                          {isFolderLike(node.type) ? <Folder className="h-4 w-4 text-primary" /> : <File className="h-4 w-4 text-muted-foreground" />}
                          {node.name}
                        </button>
                      </td>
                      <td className="p-3"><Badge>{node.type}</Badge></td>
                      <td className="p-3"><Badge>{node.status ?? (node.type === "archive-file" ? "requires_extract" : "ready")}</Badge></td>
                      <td className="p-3 text-muted-foreground">{node.type === "folder" ? "-" : formatBytes(node.size)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1 whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Copy VFS path" onClick={() => navigator.clipboard?.writeText(node.path).then(() => notify("VFS path copied.", "success"))}><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Rename" onClick={() => { setSelectedPath(node.path); setRenameTarget(node.name); }}><Pencil className="h-4 w-4" /></Button>
                          {!isFolderLike(node.type) ? <Button variant="ghost" size="icon" title="Edit text file" onClick={() => { setSelectedPath(node.path); setEditorOpen(true); }}><Pencil className="h-4 w-4" /></Button> : null}
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => { if (window.confirm(`Delete ${node.name}?`)) deletePath.mutate(node.path); }}><Trash2 className="h-4 w-4" /></Button>
                          {!isFolderLike(node.type) && node.type !== "archive-file" && <Button className="whitespace-nowrap" variant="outline" asChild><a href={apiUrl(`/api/vfs/stream?path=${encodeURIComponent(node.path)}`)}>Open</a></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {selectedNode ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Selected path actions</h2>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <Input value={renameTarget} onChange={(event) => setRenameTarget(event.target.value)} placeholder={selectedNode.name} />
            <Button
              variant="outline"
              onClick={() => {
                if (!renameTarget.trim()) return;
                renamePath.mutate({ currentPath: selectedNode.path, nextPath: joinPath(parentPath(selectedNode.path) ?? "/", renameTarget.trim()) });
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />Rename
            </Button>
          </div>
          {editorOpen && selectedPath ? (
            <div className="space-y-2">
              <textarea
                className="min-h-72 w-full rounded-xl border bg-background p-3 font-mono text-sm"
                value={editorContent}
                onChange={(event) => setEditorContent(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => saveFile.mutate({ targetPath: selectedPath, content: editorContent })}
                  disabled={!selectedText.data}
                >
                  <Save className="mr-2 h-4 w-4" />Save file
                </Button>
                <Button variant="outline" onClick={() => setEditorOpen(false)}>Close editor</Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

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
      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h2 className="text-sm font-semibold">Active streams</h2>
        </div>
        {streams.data && streams.data.length > 0 ? (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {streams.data.map((stream) => (
              <div key={stream.id} className="rounded-lg border bg-background/40 p-3">
                <div className="break-all text-sm font-medium">{stream.path}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Badge>{stream.status}</Badge>
                  <Badge>{stream.source ?? "fuse"}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{stream.range || `${stream.start}-${stream.end}`}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatBytes(stream.bytesSent)}</p>
                <div className="mt-3">
                  <Button variant="ghost" size="icon" title="Stop stream" onClick={() => stopStream.mutate(stream.id)}><Square className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
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
          </div>
          </>
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

function joinPath(base: string, name: string) {
  const trimmedBase = base === "/" ? "" : base.replace(/\/+$/, "");
  return `${trimmedBase}/${name.replace(/^\/+/, "")}`;
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
