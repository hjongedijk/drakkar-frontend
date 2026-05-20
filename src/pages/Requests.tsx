import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";
import { api, type MediaRequest, type RequestReleaseCandidate } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ToastProvider";
import { useRefreshMutation } from "../hooks/useRefreshMutation";

export function Requests() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [filter, setFilter] = useState("all");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<RequestReleaseCandidate[]>([]);
  const requests = useQuery({ queryKey: ["requests"], queryFn: api.requests, refetchInterval: 15000 });
  const sync = useRefreshMutation(() => api.syncRequests(), [["requests"]], { success: "Requests synced." });
  const approve = useRefreshMutation((id: string) => api.approveRequest(id), [["requests"]], { success: "Request approved." });
  const reject = useRefreshMutation((id: string) => api.rejectRequest(id), [["requests"]], { success: "Request rejected." });
  const search = useMutation({
    mutationFn: (id: string) => api.searchRequest(id),
    onSuccess: (result, id) => {
      setActiveRequestId(id);
      setCandidates(result.releases);
      notify(`Found ${result.releases.length} release candidates.`, "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Request search failed.", "error")
  });
  const grab = useRefreshMutation((id: string) => api.grabRequest(id), [["requests"], ["downloads", "queue"]], { success: "Best release queued." });
  const grabRelease = useMutation({
    mutationFn: ({ id, candidate }: { id: string; candidate: RequestReleaseCandidate }) => api.grabRequestRelease(id, candidate.release),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
      notify("Selected release queued.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not queue release.", "error")
  });

  if (requests.isLoading) return <LoadingState />;
  if (requests.isError) return <ErrorState message="Could not load requests." />;

  const rows = (requests.data ?? []).filter((request) => filter === "all" || request.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Imported Seerr requests.</p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-flow-col">
          <Select className="w-full sm:w-auto" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="grabbed">Grabbed</option>
            <option value="available">Available</option>
            <option value="import_failed">Import failed</option>
          </Select>
      <Button className="w-full sm:w-auto" onClick={() => { notify("Syncing Seerr requests...", "info"); sync.mutate(undefined); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync
          </Button>
        </div>
      </div>

      {rows.length === 0 ? <EmptyState message="No requests match the current filter." /> : <RequestTable rows={rows} onApprove={(id) => { notify("Approving request...", "info"); approve.mutate(id); }} onReject={(id) => { notify("Rejecting request...", "info"); reject.mutate(id); }} onSearch={(id) => { notify("Searching releases...", "info"); search.mutate(id); }} onGrab={(id) => { notify("Queueing best release...", "info"); grab.mutate(id); }} />}
      {activeRequestId && (
        <CandidatePanel
          title={rows.find((request) => request.id === activeRequestId)?.title ?? "Search results"}
          candidates={candidates}
          loading={search.isPending}
          onGrab={(candidate) => {
            notify("Queueing selected release...", "info");
            grabRelease.mutate({ id: activeRequestId, candidate });
          }}
        />
      )}
    </div>
  );
}

function RequestTable({ rows, onApprove, onReject, onSearch, onGrab }: { rows: MediaRequest[]; onApprove: (id: string) => void; onReject: (id: string) => void; onSearch: (id: string) => void; onGrab: (id: string) => void }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((request) => (
          <div key={request.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-sm font-semibold">{request.title}{request.year ? ` (${request.year})` : ""}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{request.requestedQuality ?? "default quality"}</p>
              </div>
              <Badge>{request.mediaType}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{request.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" size="icon" title="Search releases" onClick={() => onSearch(request.id)}><Search className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" title="Grab best release" onClick={() => onGrab(request.id)}><Download className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" title="Approve request" onClick={() => onApprove(request.id)}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" title="Reject request" onClick={() => onReject(request.id)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Quality</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{request.title}{request.year ? ` (${request.year})` : ""}</td>
                <td className="p-3"><Badge>{request.mediaType}</Badge></td>
                <td className="p-3"><Badge>{request.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{request.requestedQuality ?? "default"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="Search releases" onClick={() => onSearch(request.id)}><Search className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Grab best release" onClick={() => onGrab(request.id)}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Approve request" onClick={() => onApprove(request.id)}><Check className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Reject request" onClick={() => onReject(request.id)}><X className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CandidatePanel({ title, candidates, loading, onGrab }: { title: string; candidates: RequestReleaseCandidate[]; loading: boolean; onGrab: (candidate: RequestReleaseCandidate) => void }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{loading ? "Searching..." : `${candidates.length} ranked candidates`}</p>
        </div>
      </div>
      {candidates.length === 0 && !loading ? <EmptyState message="No releases found for this request." /> : (
        <>
        <div className="space-y-3 p-3 md:hidden">
          {candidates.slice(0, 12).map((candidate) => (
            <div key={candidate.release.guid} className="rounded-lg border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-medium">{candidate.release.title}</p>
                <Button variant="ghost" size="icon" title="Grab selected release" disabled={!candidate.decision.accepted} onClick={() => onGrab(candidate)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge>{candidate.release.resolution ?? "unknown"}</Badge>
                <Badge>{candidate.release.source ?? "source"}</Badge>
                <Badge>{formatBytes(candidate.release.size)}</Badge>
                <Badge>score {candidate.decision.score}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {candidate.decision.accepted ? "Accepted" : candidate.decision.reasons.slice(0, 2).join("; ")}
              </p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[860px] w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Release</th>
              <th className="p-3">Score</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Decision</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.slice(0, 12).map((candidate) => (
              <tr key={candidate.release.guid} className="border-b last:border-0">
                <td className="max-w-xl p-3 font-medium">{candidate.release.title}</td>
                <td className="p-3">{candidate.decision.score}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge>{candidate.release.resolution ?? "unknown"}</Badge>
                    <Badge>{candidate.release.source ?? "source"}</Badge>
                    <Badge>{formatBytes(candidate.release.size)}</Badge>
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {candidate.decision.accepted ? "Accepted" : candidate.decision.reasons.slice(0, 2).join("; ")}
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="icon" title="Grab selected release" disabled={!candidate.decision.accepted} onClick={() => onGrab(candidate)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}
    </div>
  );
}

function formatBytes(value?: number) {
  if (!value) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}
