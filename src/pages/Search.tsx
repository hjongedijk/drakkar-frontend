import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2, FileDown, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Release } from "../api/client";
import { EmptyState, ErrorState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ToastProvider";

export function SearchPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState<"manual" | "movie" | "tv" | "season" | "episode">("manual");
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState("");
  const [nzbTestResult, setNzbTestResult] = useState<string | null>(null);
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.profiles });
  const search = useMutation({
    mutationFn: () => api.search(kind, { query }),
    onSuccess: (results) => notify(`Found ${results.length} releases.`, "success"),
    onError: (error) => notify(error instanceof Error ? error.message : "Search failed.", "error")
  });
  const download = useMutation({
    mutationFn: (release: Release) => api.downloadRelease(release),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["downloads"] });
      notify("Release added to the queue.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not grab release.", "error")
  });
  const testNzb = useMutation({
    mutationFn: (release: Release) => api.testNzbDownload(release),
    onSuccess: (result) => {
      setNzbTestResult(
        result.ok
          ? `NZB downloaded: ${result.fileCount} files, ${result.segmentCount} segments, ${formatBytes(result.bytes)} saved.`
          : `NZB downloaded but did not validate: ${result.errors.join(", ")}`
      );
      notify(result.ok ? "NZB validated successfully." : "NZB downloaded but validation reported issues.", result.ok ? "success" : "error");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "NZB download failed";
      setNzbTestResult(message);
      notify(message, "error");
    }
  });
  const downloadNzb = useMutation({
    mutationFn: (release: Release) => api.downloadNzbFile(release),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify("NZB file downloaded.", "success");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "NZB file download failed";
      setNzbTestResult(message);
      notify(message, "error");
    }
  });

  const selectedProfile = useMemo(() => profiles.data?.find((profile) => profile.id === profileId) ?? profiles.data?.[0], [profiles.data, profileId]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search indexers and inspect release quality.</p>
      </div>

      <div className="grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[160px_1fr_220px_auto]">
        <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="manual">Manual</option>
          <option value="movie">Movie</option>
          <option value="tv">TV</option>
          <option value="season">Season</option>
          <option value="episode">Episode</option>
        </Select>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Release, movie, or show title" />
        <Select value={selectedProfile?.id ?? ""} onChange={(event) => setProfileId(event.target.value)}>
          {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </Select>
        <Button onClick={() => { notify("Searching indexers...", "info"); search.mutate(); }} disabled={!query || search.isPending}>
          <SearchIcon className="mr-2 h-4 w-4" />
          Search
        </Button>
      </div>

      {search.isError && <ErrorState message={(search.error as Error).message} />}
      {download.isError ? <ErrorState message={(download.error as Error).message} /> : null}
      {testNzb.isError ? <ErrorState message={(testNzb.error as Error).message} /> : null}
      {nzbTestResult ? <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">{nzbTestResult}</div> : null}
      {!search.data && <EmptyState message="Search results will appear here." />}
      {search.data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Release</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Source</th>
                <th className="p-3">Codec</th>
                <th className="p-3">Indexer</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {search.data.map((release) => (
                <tr key={release.guid} className="border-b last:border-0">
                  <td className="max-w-xl p-3 font-medium">{release.title}</td>
                  <td className="p-3"><Badge>{release.resolution ?? "unknown"}</Badge></td>
                  <td className="p-3"><Badge>{release.source ?? "unknown"}</Badge></td>
                  <td className="p-3"><Badge>{release.codec ?? "unknown"}</Badge></td>
                  <td className="p-3 text-muted-foreground">{release.indexer}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" title="Download and validate NZB" onClick={() => { notify("Testing NZB...", "info"); testNzb.mutate(release); }} disabled={!release.downloadUrl || testNzb.isPending}>
                      <FileCheck2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Download NZB file" onClick={() => { notify("Downloading NZB file...", "info"); downloadNzb.mutate(release); }} disabled={!release.downloadUrl || downloadNzb.isPending}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Grab release" onClick={() => { notify("Adding release to queue...", "info"); download.mutate(release); }} disabled={!release.downloadUrl || download.isPending}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
