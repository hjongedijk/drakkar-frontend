import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, apiRequest, type QualityProfile, type Release } from "../api/client";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ToastProvider";
import {
  activeRankingSignals,
  defaultProfileDraft,
  describeProfile
} from "../lib/profile-ranking";

const qualityOptions = ["480p", "720p", "1080p", "2160p"];
const languageOptions = ["english", "dutch", "multi", "dual", "french", "german", "spanish", "japanese"];

export function Profiles() {
  const [title, setTitle] = useState("Example.Movie.2026.1080p.WEB-DL.x265-GROUP");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("profile") ?? "";
  const [draft, setDraft] = useState<Omit<QualityProfile, "id">>(defaultProfileDraft);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.profiles });
  const selected = useMemo(
    () => (profiles.data ?? []).find((profile) => profile.id === selectedId) ?? null,
    [profiles.data, selectedId]
  );

  useEffect(() => {
    if (!profiles.data?.length) return;
    if (!selectedId || !selected) {
      const firstProfile = profiles.data[0];
      if (firstProfile) setSearchParams({ profile: firstProfile.id }, { replace: true });
    }
  }, [profiles.data, selected, selectedId, setSearchParams]);

  useEffect(() => {
    if (selected) setDraft(profileToDraft(selected));
  }, [selected]);

  const create = useMutation({
    mutationFn: (input?: Partial<QualityProfile>) =>
      apiRequest<QualityProfile>("/api/profiles", {
        method: "POST",
        body: JSON.stringify({
          ...defaultProfileDraft,
          ...input,
          name: input?.name ?? `Custom ${Date.now()}`
        })
      }),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setSearchParams({ profile: profile.id });
      notify("Quality profile created.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not create profile.", "error")
  });
  const save = useMutation({
    mutationFn: (profile: QualityProfile) =>
      apiRequest<QualityProfile>(`/api/profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify(draftToPayload(draft))
      }),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setSearchParams({ profile: profile.id });
      notify("Quality profile saved.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not save profile.", "error")
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest<unknown>(`/api/profiles/${id}`, { method: "DELETE" }),
    onSuccess: async (_, id) => {
      const nextProfiles = (profiles.data ?? []).filter((profile) => profile.id !== id);
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      if (nextProfiles[0]) setSearchParams({ profile: nextProfiles[0].id });
      else setSearchParams({});
      notify("Quality profile removed.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not remove profile.", "error")
  });
  const test = useMutation({
    mutationFn: (profile: QualityProfile) =>
      apiRequest<{ accepted: boolean; score: number; reasons: string[] }>(`/api/profiles/${profile.id}/test`, {
        method: "POST",
        body: JSON.stringify({ release: fakeRelease(title) })
      }),
    onSuccess: (result) =>
      notify(
        result.accepted ? "Release accepted by this profile." : "Release rejected by this profile.",
        result.accepted ? "success" : "info"
      ),
    onError: (error) => notify(error instanceof Error ? error.message : "Profile test failed.", "error")
  });

  if (profiles.isLoading) return <LoadingState />;
  if (profiles.isError) return <ErrorState message="Could not load quality profiles." />;

  const dirty = selected ? JSON.stringify(profileToDraft(selected)) !== JSON.stringify(draft) : false;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Profiles</h1>
          <Button size="icon" onClick={() => create.mutate(undefined)}><Plus className="h-4 w-4" /></Button>
        </div>
        {(profiles.data ?? []).map((profile) => (
          <button
            key={profile.id}
            className={`block w-full rounded-lg border p-4 text-left transition ${profile.id === selectedId ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"}`}
            onClick={() => setSearchParams({ profile: profile.id })}
          >
            <div className="font-medium">{profile.name}</div>
            <div className="mt-2 flex flex-wrap gap-1">{profile.allowedQualities.map((quality) => <Badge key={quality}>{quality}</Badge>)}</div>
            <div className="mt-3 text-xs text-muted-foreground">{describeProfile(profile).slice(0, 4).join(" · ")}</div>
          </button>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        {!selected ? (
          <EmptyState message="Select a profile to inspect rules and test a release title." />
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Edit profile rules, audio preference, and ranking gates.</p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </Field>
              <Field label="Cutoff quality">
                <Select value={draft.cutoffQuality ?? ""} onChange={(event) => setDraft({ ...draft, cutoffQuality: event.target.value || null })}>
                  <option value="">None</option>
                  {qualityOptions.map((quality) => <option key={quality} value={quality}>{quality}</option>)}
                </Select>
              </Field>
              <Field label="Allowed qualities">
                <TokenInput value={draft.allowedQualities} onChange={(value) => setDraft({ ...draft, allowedQualities: value })} placeholder="1080p,2160p" />
              </Field>
              <Field label="Preferred audio languages">
                <TokenInput value={draft.preferredLanguages} onChange={(value) => setDraft({ ...draft, preferredLanguages: value })} placeholder="english,japanese" suggestions={languageOptions} />
              </Field>
              <Field label="Only allow audio languages">
                <TokenInput value={draft.requiredLanguages} onChange={(value) => setDraft({ ...draft, requiredLanguages: value })} placeholder="english" suggestions={languageOptions} />
              </Field>
              <Field label="Min size bytes">
                <Input value={draft.minSize ?? ""} onChange={(event) => setDraft({ ...draft, minSize: numberOrNull(event.target.value) })} inputMode="numeric" />
              </Field>
              <Field label="Max size bytes">
                <Input value={draft.maxSize ?? ""} onChange={(event) => setDraft({ ...draft, maxSize: numberOrNull(event.target.value) })} inputMode="numeric" />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Preferred words">
                <TokenInput value={draft.preferredWords} onChange={(value) => setDraft({ ...draft, preferredWords: value })} placeholder="remux,hdr,atmos" />
              </Field>
              <Field label="Required words">
                <TokenInput value={draft.requiredWords} onChange={(value) => setDraft({ ...draft, requiredWords: value })} placeholder="web-dl" />
              </Field>
              <Field label="Rejected words">
                <TokenInput value={draft.rejectedWords} onChange={(value) => setDraft({ ...draft, rejectedWords: value })} placeholder="cam,dubbed-only" />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ToggleGroup
                title="Allow Formats"
                items={[
                  toggleItem("HDR", draft.allowHDR, (checked) => setDraft({ ...draft, allowHDR: checked })),
                  toggleItem("Dolby Vision", draft.allowDV, (checked) => setDraft({ ...draft, allowDV: checked })),
                  toggleItem("Remux", draft.allowRemux, (checked) => setDraft({ ...draft, allowRemux: checked })),
                  toggleItem("BluRay", draft.allowBluRay, (checked) => setDraft({ ...draft, allowBluRay: checked })),
                  toggleItem("WEB-DL", draft.allowWebDL, (checked) => setDraft({ ...draft, allowWebDL: checked })),
                  toggleItem("WEBRip", draft.allowWebRip, (checked) => setDraft({ ...draft, allowWebRip: checked })),
                  toggleItem("x264", draft.allowX264, (checked) => setDraft({ ...draft, allowX264: checked })),
                  toggleItem("x265/HEVC", draft.allowX265, (checked) => setDraft({ ...draft, allowX265: checked })),
                  toggleItem("AV1", draft.allowAV1, (checked) => setDraft({ ...draft, allowAV1: checked })),
                  toggleItem("Multi audio", draft.allowMultiAudio, (checked) => setDraft({ ...draft, allowMultiAudio: checked }))
                ]}
              />
              <ToggleGroup
                title="Reject Trash"
                items={[
                  toggleItem("CAM", draft.rejectCam, (checked) => setDraft({ ...draft, rejectCam: checked })),
                  toggleItem("Telesync", draft.rejectTelesync, (checked) => setDraft({ ...draft, rejectTelesync: checked })),
                  toggleItem("Screener", draft.rejectScreener, (checked) => setDraft({ ...draft, rejectScreener: checked })),
                  toggleItem("Passworded", draft.rejectPassworded, (checked) => setDraft({ ...draft, rejectPassworded: checked })),
                  toggleItem("Suspicious", draft.rejectSuspicious, (checked) => setDraft({ ...draft, rejectSuspicious: checked }))
                ]}
              />
              <ToggleGroup
                title="Prefer Boosts"
                items={[
                  toggleItem("Proper", draft.preferProper, (checked) => setDraft({ ...draft, preferProper: checked })),
                  toggleItem("Repack", draft.preferRepack, (checked) => setDraft({ ...draft, preferRepack: checked }))
                ]}
              />
            </div>

            <div className="rounded-md border bg-background/60 p-4 text-sm">
              <h3 className="font-semibold">Ranking Signals</h3>
              <p className="mt-2 text-muted-foreground">Active score path now.</p>
              <div className="mt-3 flex flex-wrap gap-1">{activeRankingSignals.map((value) => <Badge key={value}>{value}</Badge>)}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save.mutate(selected)} disabled={!dirty || save.isPending}><Save className="mr-2 h-4 w-4" />Save</Button>
              <Button variant="ghost" onClick={() => setDraft(profileToDraft(selected))} disabled={!dirty}>Reset</Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Test Release</h3>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                <Button className="sm:w-auto" onClick={() => test.mutate(selected)}>Score</Button>
              </div>
              {test.data ? (
                <div className="rounded-md border p-3 text-sm">
                  Score {test.data.score} · {test.data.accepted ? "accepted" : "rejected"} · {test.data.reasons.join(", ") || "no rejection reasons"}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function profileToDraft(profile: QualityProfile): Omit<QualityProfile, "id"> {
  return {
    name: profile.name,
    allowedQualities: profile.allowedQualities,
    cutoffQuality: profile.cutoffQuality ?? null,
    preferredWords: profile.preferredWords,
    rejectedWords: profile.rejectedWords,
    requiredWords: profile.requiredWords,
    preferredLanguages: profile.preferredLanguages,
    requiredLanguages: profile.requiredLanguages,
    minSize: profile.minSize ?? null,
    maxSize: profile.maxSize ?? null,
    allowHDR: profile.allowHDR,
    allowDV: profile.allowDV,
    allowRemux: profile.allowRemux,
    allowBluRay: profile.allowBluRay,
    allowWebDL: profile.allowWebDL,
    allowWebRip: profile.allowWebRip,
    allowX264: profile.allowX264,
    allowX265: profile.allowX265,
    allowAV1: profile.allowAV1,
    allowMultiAudio: profile.allowMultiAudio,
    rejectCam: profile.rejectCam,
    rejectTelesync: profile.rejectTelesync,
    rejectScreener: profile.rejectScreener,
    rejectPassworded: profile.rejectPassworded,
    rejectSuspicious: profile.rejectSuspicious,
    preferProper: profile.preferProper,
    preferRepack: profile.preferRepack
  };
}

function draftToPayload(draft: Omit<QualityProfile, "id">) {
  return {
    ...draft,
    name: draft.name.trim(),
    allowedQualities: uniq(draft.allowedQualities),
    preferredWords: uniq(draft.preferredWords),
    rejectedWords: uniq(draft.rejectedWords),
    requiredWords: uniq(draft.requiredWords),
    preferredLanguages: uniq(draft.preferredLanguages.map((value) => value.toLowerCase())),
    requiredLanguages: uniq(draft.requiredLanguages.map((value) => value.toLowerCase()))
  };
}

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toggleItem(label: string, checked: boolean, onChange: (checked: boolean) => void) {
  return { label, checked, onChange };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

function ToggleGroup({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; checked: boolean; onChange: (checked: boolean) => void }>;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <label key={item.label} className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2 text-sm">
            <span>{item.label}</span>
            <input type="checkbox" checked={item.checked} onChange={(event) => item.onChange(event.target.checked)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  return (
    <div className="space-y-2">
      <Input value={value.join(", ")} onChange={(event) => onChange(splitTokens(event.target.value))} placeholder={placeholder} />
      {suggestions?.length ? (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full border px-2 py-1 text-xs hover:bg-muted"
              onClick={() => onChange(uniq([...value, item]))}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function splitTokens(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function fakeRelease(title: string): Release {
  return { title, guid: title, indexer: "manual", hdr: /\bhdr\b/i.test(title), dv: /\bdv\b/i.test(title), isProper: /\bproper\b/i.test(title), isRepack: /\brepack\b/i.test(title), isRemux: /\bremux\b/i.test(title), rawAttributes: {} };
}
