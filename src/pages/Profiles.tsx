import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, apiRequest, type QualityProfile, type Release } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToast } from "../components/ToastProvider";

export function Profiles() {
  const [title, setTitle] = useState("Example.Movie.2026.1080p.WEB-DL.x265-GROUP");
  const [selected, setSelected] = useState<QualityProfile | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.profiles });
  const create = useMutation({
    mutationFn: (input?: Partial<QualityProfile>) => apiRequest<QualityProfile>("/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: input?.name ?? `Custom ${Date.now()}`,
        allowedQualities: input?.allowedQualities ?? ["1080p"],
        cutoffQuality: input?.cutoffQuality ?? undefined,
        preferredWords: input?.preferredWords ?? [],
        rejectedWords: input?.rejectedWords ?? [],
        requiredWords: input?.requiredWords ?? [],
        preferredLanguages: input?.preferredLanguages ?? [],
        requiredLanguages: input?.requiredLanguages ?? []
      })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      notify("Quality profile created.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not create profile.", "error")
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/api/profiles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setSelected(null);
      notify("Quality profile removed.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not remove profile.", "error")
  });
  const test = useMutation({
    mutationFn: (profile: QualityProfile) => apiRequest<{ accepted: boolean; score: number; reasons: string[] }>(`/api/profiles/${profile.id}/test`, {
      method: "POST",
      body: JSON.stringify({ release: fakeRelease(title) })
    }),
    onSuccess: (result) => notify(result.accepted ? "Release accepted by this profile." : "Release rejected by this profile.", result.accepted ? "success" : "info"),
    onError: (error) => notify(error instanceof Error ? error.message : "Profile test failed.", "error")
  });

  if (profiles.isLoading) return <LoadingState />;
  if (profiles.isError) return <ErrorState message="Could not load quality profiles." />;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Profiles</h1>
          <Button size="icon" onClick={() => create.mutate(undefined)}><Plus className="h-4 w-4" /></Button>
        </div>
        {(profiles.data ?? []).map((profile) => (
          <button key={profile.id} className="block w-full rounded-lg border bg-card p-4 text-left hover:bg-muted" onClick={() => setSelected(profile)}>
            <div className="font-medium">{profile.name}</div>
            <div className="mt-2 flex flex-wrap gap-1">{profile.allowedQualities.map((quality) => <Badge key={quality}>{quality}</Badge>)}</div>
          </button>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        {!selected ? <EmptyState message="Select a profile to inspect rules and test a release title." /> : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cutoff: {selected.cutoffQuality ?? "none"}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    create.mutate({
                      ...selected,
                      name: `${selected.name} Copy`
                    })
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(selected.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <RuleBlock title="Preferred" values={selected.preferredWords} />
            <RuleBlock title="Rejected" values={selected.rejectedWords} />
            <RuleBlock title="Required" values={selected.requiredWords} />
            <div className="rounded-md border bg-background/60 p-3 text-sm text-muted-foreground">
              <h3 className="mb-2 font-semibold text-foreground">Ranking Method</h3>
              <p>Accepted releases are sorted by score: resolution, source, codec, preferred words, preferred languages, proper/repack flags, and seeders. Rejected rules subtract heavily so they fall out of automatic grabs.</p>
              <p className="mt-2">Current cutoff: {selected.cutoffQuality ?? "none"} · Allowed: {selected.allowedQualities.join(", ") || "any"}.</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Test Release</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                <Button className="sm:w-auto" onClick={() => test.mutate(selected)}>Score</Button>
              </div>
              {test.data && <div className="rounded-md border p-3 text-sm">Score {test.data.score} · {test.data.accepted ? "accepted" : "rejected"} · {test.data.reasons.join(", ") || "no rejection reasons"}</div>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RuleBlock({ title, values }: { title: string; values: string[] }) {
  return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="flex flex-wrap gap-1">{values.length ? values.map((value) => <Badge key={value}>{value}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}</div></div>;
}

function fakeRelease(title: string): Release {
  return { title, guid: title, indexer: "manual", hdr: /\bhdr\b/i.test(title), dv: /\bdv\b/i.test(title), isProper: /\bproper\b/i.test(title), isRepack: /\brepack\b/i.test(title), isRemux: /\bremux\b/i.test(title), rawAttributes: {} };
}
