import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, RefreshCw } from "lucide-react";
import { api, type ScheduledTask } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { StatusPill } from "../components/StatusPill";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function TasksPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: api.tasks,
    refetchInterval: 5000
  });
  const runTask = useMutation({
    mutationFn: api.runTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] })
  });

  if (tasks.isLoading) return <LoadingState />;
  if (tasks.isError || !tasks.data) return <ErrorState message="Could not load scheduled tasks." />;

  const runningCount = tasks.data.tasks.filter((task) => task.status === "running").length;
  const enabledCount = tasks.data.tasks.filter((task) => task.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Scheduled backend jobs for request sync, queue recovery, imports, and mounted health checks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill value={`${enabledCount} enabled`} />
          <StatusPill value={`${runningCount} running`} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-semibold">Scheduled</h2>
          <Button variant="outline" onClick={() => tasks.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {tasks.data.tasks.map((task) => (
            <TaskCard key={task.id} task={task} running={runTask.isPending} onRun={() => runTask.mutate(task.id)} />
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Interval</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Execution</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Next Execution</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.data.tasks.map((task) => (
                <tr key={task.id} className="border-b border-white/5 align-top last:border-0">
                  <td className="p-4">
                    <div className="font-semibold">{task.name}</div>
                    <div className="mt-1 max-w-xl text-xs text-muted-foreground">{task.description}</div>
                    {task.lastError ? <div className="mt-2 text-xs font-semibold text-red-300">{task.lastError}</div> : null}
                  </td>
                  <td className="p-4 text-muted-foreground">{formatInterval(task.intervalMs)}</td>
                  <td className="p-4">{statusBadge(task)}</td>
                  <td className="p-4 text-muted-foreground">{formatDate(task.lastCompletedAt ?? task.lastStartedAt, "Never")}</td>
                  <td className="p-4 text-muted-foreground">{formatDuration(task.lastDurationMs)}</td>
                  <td className="p-4 text-muted-foreground">{task.enabled ? formatDate(task.nextRunAt, task.intervalMs ? "Pending" : "-") : "Disabled"}</td>
                  <td className="p-4 text-right">
                    <Button
                      variant="outline"
                      disabled={!task.enabled || !task.manualRunnable || task.status === "running" || runTask.isPending}
                      onClick={() => runTask.mutate(task.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Run
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TaskCard({ task, running, onRun }: { task: ScheduledTask; running: boolean; onRun: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{task.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{task.description}</div>
        </div>
        {statusBadge(task)}
      </div>
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
        <div>Interval: {formatInterval(task.intervalMs)}</div>
        <div>Last: {formatDate(task.lastCompletedAt ?? task.lastStartedAt, "Never")}</div>
        <div>Next: {task.enabled ? formatDate(task.nextRunAt, task.intervalMs ? "Pending" : "-") : "Disabled"}</div>
        {task.lastError ? <div className="font-semibold text-red-300">{task.lastError}</div> : null}
      </div>
      <Button className="mt-4 w-full" variant="outline" disabled={!task.enabled || !task.manualRunnable || task.status === "running" || running} onClick={onRun}>
        <Play className="mr-2 h-4 w-4" />
        Run now
      </Button>
    </div>
  );
}

function statusBadge(task: ScheduledTask) {
  const tone = {
    idle: "border-slate-400/30 bg-slate-500/20 text-slate-200",
    running: "border-cyan-400/30 bg-cyan-500/20 text-cyan-200",
    success: "border-emerald-400/30 bg-emerald-500/20 text-emerald-200",
    failed: "border-red-400/30 bg-red-500/20 text-red-200",
    disabled: "border-amber-400/30 bg-amber-500/20 text-amber-200"
  }[task.status];
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${tone}`}>{task.status.replace("_", " ")}</span>;
}

function formatInterval(value?: number | null) {
  if (!value) return "Manual/startup";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr`;
}

function formatDuration(value?: number | null) {
  if (!value) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
}

function formatDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
