import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Database, FolderTree, HardDrive, RadioTower, Server, ShieldCheck, Tv, XCircle } from "lucide-react";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { StatusPill } from "../components/StatusPill";
import { Card } from "../components/ui/card";

type ServiceRow = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  icon: typeof Server;
};

export function ServicesPage() {
  const status = useQuery({
    queryKey: ["status"],
    queryFn: api.status,
    refetchInterval: 15000
  });
  const setup = useQuery({
    queryKey: ["setup-status"],
    queryFn: api.setupStatus,
    refetchInterval: 15000
  });

  if (status.isLoading || setup.isLoading) return <LoadingState />;
  if (status.isError || !status.data || setup.isError || !setup.data) return <ErrorState message="Could not load service status." />;

  const rows: ServiceRow[] = [
    { key: "backend", label: "Backend API", ok: status.data.backend === "ok", detail: status.data.backend, icon: Server },
    { key: "postgres", label: "PostgreSQL", ok: status.data.postgresql === "ok", detail: status.data.postgresql, icon: Database },
    { key: "valkey", label: "Valkey", ok: status.data.valkey === "ok", detail: status.data.valkey, icon: Database },
    { key: "nzbhydra", label: "NZBHydra2", ok: status.data.nzbhydra === "ok" && setup.data.checks.nzbhydra, detail: setup.data.checks.nzbhydra ? status.data.nzbhydra : "not configured", icon: RadioTower },
    { key: "usenet", label: "Usenet", ok: setup.data.checks.usenet, detail: setup.data.checks.usenet ? `${status.data.bandwidth?.allocation.downloads ?? 0} download connection(s)` : "not configured", icon: HardDrive },
    { key: "seerr", label: "Seerr", ok: status.data.seerr === "ok" && setup.data.checks.requestProvider, detail: setup.data.checks.requestProvider ? status.data.seerr : "not configured", icon: Tv },
    { key: "metadata", label: "Metadata", ok: setup.data.checks.metadata, detail: setup.data.checks.metadata ? "configured" : "needs API key", icon: ShieldCheck },
    { key: "plex", label: "Plex", ok: setup.data.checks.plex, detail: setup.data.checks.plex ? "configured" : "not configured", icon: Tv },
    { key: "fuse", label: "FUSE / VFS", ok: Boolean(status.data.fuse?.enabled && status.data.fuse?.mounted), detail: status.data.fuse?.mounted ? status.data.fuse.path : (status.data.fuse?.error || "not mounted"), icon: FolderTree }
  ];

  const healthyCount = rows.filter((row) => row.ok).length;
  const storage = status.data.storageUsage;
  const storageUsedPercent = storage && storage.totalBytes > 0 ? Math.round((storage.usedBytes / storage.totalBytes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connection and runtime status for the services Drakkar depends on.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryCard label="Services healthy" value={`${healthyCount}/${rows.length}`} tone="text-emerald-400" />
        <SummaryCard label="Queue waiting" value={String(status.data.queues?.waiting ?? status.data.queueSize ?? 0)} tone="text-cyan-400" />
        <SummaryCard label="Queue active" value={String(status.data.queues?.active ?? status.data.activeDownloads ?? 0)} tone="text-amber-300" />
        <SummaryCard label="Storage used" value={storage ? `${storageUsedPercent}%` : "n/a"} tone="text-rose-300" />
      </div>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Connected Services</h2>
          <StatusPill value={setup.data.completed ? "Setup complete" : "Setup incomplete"} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.06]">
                    <row.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">{row.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{row.detail}</div>
                  </div>
                </div>
                {row.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-rose-400" />}
              </div>
              <div className="mt-4">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${row.ok ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200" : "border-rose-400/30 bg-rose-500/15 text-rose-200"}`}>
                  {row.ok ? "Ready" : "Attention needed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Runtime</h2>
          <StatusPill value={`Drakkar ${status.data.version ?? "unknown"}`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <RuntimeCard label="Active downloads" value={String(status.data.activeDownloads)} />
          <RuntimeCard label="Queued items" value={String(status.data.queueSize)} />
          <RuntimeCard label="Download connections" value={String(status.data.bandwidth?.allocation.downloads ?? 0)} />
          <RuntimeCard label="Streaming sessions" value={String(status.data.bandwidth?.activeStreamCount ?? 0)} />
        </div>
        {storage ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Storage usage</span>
              <span className="text-muted-foreground">{formatBytes(storage.usedBytes)} / {formatBytes(storage.totalBytes)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/30">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(0, Math.min(100, storageUsedPercent))}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{formatBytes(storage.freeBytes)} free</div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-6">
      <div className={`text-4xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

function RuntimeCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
