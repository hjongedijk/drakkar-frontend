import { useQuery } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { StatusPill } from "../components/StatusPill";
import { Card } from "../components/ui/card";

export function HealthPage() {
  const health = useQuery({
    queryKey: ["health", "checks"],
    queryFn: api.healthChecks,
    refetchInterval: 15000
  });

  if (health.isLoading) return <LoadingState />;
  if (health.isError || !health.data) return <ErrorState message="Could not load health schedule." />;

  const { overview, uncheckedCount, schedule } = health.data;
  const percent = (count: number) => (overview.totalChecked > 0 ? Math.round((count / overview.totalChecked) * 100) : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">Repair history and upcoming health-check schedule for available media.</p>
      </div>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Overview</h2>
          <StatusPill value="Last 30 days" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Checked" value={overview.totalChecked} />
          <StatCard label={`Healthy (${percent(overview.healthy)}%)`} value={overview.healthy} tone="text-emerald-400" />
          <StatCard label={`Repaired (${percent(overview.repaired)}%)`} value={overview.repaired} tone="text-cyan-400" />
          <StatCard label={`Deleted (${percent(overview.deleted)}%)`} value={overview.deleted} tone="text-red-400" />
        </div>
      </Card>

      {uncheckedCount > 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
            <HeartPulse className="h-4 w-4" />
            Attention
          </div>
          <ul className="list-disc space-y-1 pl-5 text-amber-100/90">
            <li>You have about {uncheckedCount} item(s) whose health has never been checked.</li>
            <li>The queue will run an initial health check for these items.</li>
            <li>Under normal operation, health checks happen much less often.</li>
          </ul>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-2xl font-semibold">Schedule</h2>
          <StatusPill value={`Only ${Math.min(schedule.length, 10)} shown`} />
        </div>

        {schedule.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">No items queued for health checks yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Last Check</th>
                  <th className="p-4">Next Check</th>
                </tr>
              </thead>
              <tbody>
                {schedule.slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="p-4">
                      <div className="font-semibold">{item.name}</div>
                      <div className="mt-1 max-w-[52rem] truncate text-xs text-muted-foreground">{item.path}</div>
                    </td>
                    <td className="p-4">{badge(formatDate(item.createdAt, "Unknown"), "info")}</td>
                    <td className="p-4">{badge(formatDate(item.lastCheckAt, "Never"), "warning")}</td>
                    <td className="p-4">
                      {item.progress > 0
                        ? progressBadge(item.progress)
                        : badge(formatDate(item.nextCheckAt, "ASAP"), item.lastCheckAt ? "success" : "warning")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
      <div className={`text-4xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
}

function badge(label: string, tone: "info" | "warning" | "success") {
  const classes = {
    info: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
    warning: "bg-amber-500/20 text-amber-200 border-amber-400/30",
    success: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${classes[tone]}`}>{label}</span>;
}

function progressBadge(progress: number) {
  return (
    <div className="inline-flex min-w-24 items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
      <span>{Math.round(progress)}%</span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.max(6, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}
