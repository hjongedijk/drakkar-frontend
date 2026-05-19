import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api, type RequestProviderInput, type Settings as SettingsType, type UsenetServerInput } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ToastProvider";

type SettingsTab = "integrations" | "providers" | "queue" | "library" | "rules" | "system";

const defaultRequestProvider: RequestProviderInput = {
  type: "seerr",
  name: "",
  baseUrl: "",
  apiKey: "",
  enabled: true,
  syncIntervalMinutes: 15
};

const defaultUsenetServer: UsenetServerInput = {
  name: "",
  host: "",
  port: 563,
  ssl: true,
  username: "",
  password: "",
  connections: 10,
  priority: 0,
  enabled: true,
  isBackup: false
};

const queueDecisionRows = [
  ["grabbedSeriesIdMismatch", "Found matching series via grab history, but release matched no series by ID. Automatic import is not possible."],
  ["grabbedMovieIdMismatch", "Found matching movie via grab history, but release matched no movie by ID. Manual import required."],
  ["episodeMissingInRelease", "Episode was not found in the grabbed release"],
  ["unexpectedEpisodes", "Episode(s) were unexpected considering the folder name"],
  ["notEpisodeUpgrade", "Not an upgrade for existing episode file(s)"],
  ["notMovieUpgrade", "Not an upgrade for existing movie file"],
  ["notCustomFormatUpgrade", "Not a Custom Format upgrade"],
  ["noEligibleFiles", "No files found are eligible for import"],
  ["episodeAlreadyImported", "Episode file already imported"],
  ["noAudioTracks", "No audio tracks detected"],
  ["invalidSeasonEpisode", "Invalid season or episode"],
  ["singleEpisodeContainsSeason", "Single episode file contains all episodes in seasons"],
  ["unableToDetermineSample", "Unable to determine if file is a sample"],
  ["sample", "Sample"],
  ["archiveNeedsExtraction", "Found archive file, might need to be extracted"]
] as const;

const queueDecisionLabels = {
  do_nothing: "Do Nothing",
  remove: "Remove",
  remove_and_blocklist: "Remove and Blocklist",
  remove_blocklist_and_search: "Remove, Blocklist, and Search",
  search_again: "Search Again"
} as const;

export function Settings() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user, setUser, logout } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const providers = useQuery({ queryKey: ["request-providers"], queryFn: api.requestProviders });
  const usenet = useQuery({ queryKey: ["usenet"], queryFn: api.usenetServers });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.profiles });
  const policies = useQuery({ queryKey: ["policies"], queryFn: api.policies });
  const ignoredFiles = useQuery({ queryKey: ["ignored-files"], queryFn: api.ignoredFiles });
  const blocklist = useQuery({ queryKey: ["blocklist"], queryFn: api.blocklist });
  const naming = useQuery({ queryKey: ["naming"], queryFn: api.naming });
  const authTokens = useQuery({ queryKey: ["auth", "tokens"], queryFn: api.authTokens });
  const [draft, setDraft] = useState<SettingsType | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("integrations");
  const [policyDraft, setPolicyDraft] = useState<Awaited<ReturnType<typeof api.policies>> | null>(null);
  const [namingDraft, setNamingDraft] = useState<Awaited<ReturnType<typeof api.naming>> | null>(null);
  const [namingPreview, setNamingPreview] = useState<Awaited<ReturnType<typeof api.previewNaming>> | null>(null);
  const [ignoredDraft, setIgnoredDraft] = useState("");
  const [ignoredTestPath, setIgnoredTestPath] = useState("");
  const [ignoredTestResult, setIgnoredTestResult] = useState<string | null>(null);
  const [blockTitle, setBlockTitle] = useState("");
  const [requestProvider, setRequestProvider] = useState<RequestProviderInput>(defaultRequestProvider);
  const [usenetServer, setUsenetServer] = useState<UsenetServerInput>(defaultUsenetServer);
  const [profileDraft, setProfileDraft] = useState({ username: user?.username ?? "admin", displayName: user?.displayName ?? "admin" });
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: "", newPassword: "" });
  const [tokenName, setTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (value: SettingsType) => api.updateSettings(value),
    onSuccess: () => {
      notify("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not save settings")
  });
  const savePolicies = useMutation({
    mutationFn: (value: NonNullable<typeof policyDraft>) => api.updatePolicies(value),
    onSuccess: () => {
      notify("Policies saved");
      queryClient.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not save policies")
  });
  const saveIgnored = useMutation({
    mutationFn: (value: string) => api.updateIgnoredFiles(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)),
    onSuccess: () => {
      notify("Ignored-file rules saved");
      queryClient.invalidateQueries({ queryKey: ["ignored-files"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not save ignored-file rules")
  });
  const saveNaming = useMutation({
    mutationFn: (value: NonNullable<typeof namingDraft>) => api.updateNaming(value),
    onSuccess: () => {
      notify("Naming rules saved");
      queryClient.invalidateQueries({ queryKey: ["naming"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not save naming rules")
  });
  const previewNaming = useMutation({
    mutationFn: () => api.previewNaming({ strategy: policyDraft?.importStrategy }),
    onSuccess: setNamingPreview
  });
  const testIgnored = useMutation({
    mutationFn: (path: string) => api.testIgnoredFile(path),
    onSuccess: (result) => setIgnoredTestResult(result.ignored ? `Ignored by ${result.matches.join(", ")}` : "Not ignored")
  });
  const addBlock = useMutation({
    mutationFn: (title: string) => api.addBlocklistItem({ title, reason: "manual", source: "settings" }),
    onSuccess: () => {
      notify("Blocklist item added");
      setBlockTitle("");
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not add blocklist item")
  });
  const deleteBlock = useMutation({
    mutationFn: (id: string) => api.deleteBlocklistItem(id),
    onSuccess: () => {
      notify("Blocklist item removed");
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not remove blocklist item")
  });
  const createProvider = useMutation({
    mutationFn: (value: RequestProviderInput) => api.createRequestProvider(cleanRequestProvider(value)),
    onSuccess: () => {
      notify("Seerr provider added");
      setRequestProvider(defaultRequestProvider);
      queryClient.invalidateQueries({ queryKey: ["request-providers"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not add Seerr provider")
  });
  const updateProvider = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateRequestProvider(id, { enabled }),
    onSuccess: () => {
      notify("Seerr provider updated");
      queryClient.invalidateQueries({ queryKey: ["request-providers"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update Seerr provider")
  });
  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.deleteRequestProvider(id),
    onSuccess: () => {
      notify("Seerr provider deleted");
      queryClient.invalidateQueries({ queryKey: ["request-providers"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not delete Seerr provider")
  });
  const testProvider = useMutation({
    mutationFn: (id: string) => api.testRequestProvider(id),
    onSuccess: (result) => setTestResult(result.message ?? "Connection OK"),
    onError: (error) => setTestResult(error instanceof Error ? error.message : "Connection failed")
  });
  const createUsenet = useMutation({
    mutationFn: (value: UsenetServerInput) => api.createUsenetServer(cleanUsenetServer(value)),
    onSuccess: () => {
      notify("Usenet provider added");
      setUsenetServer(defaultUsenetServer);
      queryClient.invalidateQueries({ queryKey: ["usenet"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not add Usenet provider")
  });
  const updateUsenet = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateUsenetServer(id, { enabled }),
    onSuccess: () => {
      notify("Usenet provider updated");
      queryClient.invalidateQueries({ queryKey: ["usenet"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update Usenet provider")
  });
  const deleteUsenet = useMutation({
    mutationFn: (id: string) => api.deleteUsenetServer(id),
    onSuccess: () => {
      notify("Usenet provider deleted");
      queryClient.invalidateQueries({ queryKey: ["usenet"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not delete Usenet provider")
  });
  const saveProfile = useMutation({
    mutationFn: () => api.updateProfile(profileDraft),
    onSuccess: ({ user: nextUser }) => {
      setUser(nextUser);
      notify("Account updated");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update account")
  });
  const savePassword = useMutation({
    mutationFn: () => api.changePassword(passwordDraft),
    onSuccess: () => {
      setPasswordDraft({ currentPassword: "", newPassword: "" });
      notify("Password updated");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update password")
  });
  const createToken = useMutation({
    mutationFn: () => api.createAuthToken({ name: tokenName }),
    onSuccess: (result) => {
      setCreatedToken(result.token);
      setTokenName("");
      queryClient.invalidateQueries({ queryKey: ["auth", "tokens"] });
      notify("API token created");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not create API token")
  });
  const deleteToken = useMutation({
    mutationFn: (id: string) => api.deleteAuthToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "tokens"] });
      notify("API token revoked");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not revoke API token")
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);
  useEffect(() => {
    if (policies.data) setPolicyDraft(policies.data);
  }, [policies.data]);
  useEffect(() => {
    if (ignoredFiles.data) setIgnoredDraft(ignoredFiles.data.join("\n"));
  }, [ignoredFiles.data]);
  useEffect(() => {
    if (naming.data) setNamingDraft(naming.data);
  }, [naming.data]);
  useEffect(() => {
    if (user) setProfileDraft({ username: user.username, displayName: user.displayName });
  }, [user]);

  if (settings.isLoading || policies.isLoading || naming.isLoading || !draft || !policyDraft || !namingDraft) return <LoadingState />;
  if (settings.isError) return <ErrorState message="Could not load settings." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">General, integrations, paths, services, and API compatibility.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2">
        {[
          ["integrations", "Integrations"],
          ["providers", "Providers"],
          ["queue", "Queue"],
          ["library", "Library"],
          ["rules", "Rules"],
          ["system", "System"]
        ].map(([value, label]) => (
          <Button key={value} variant={settingsTab === value ? "default" : "ghost"} onClick={() => setSettingsTab(value as SettingsTab)}>
            {label}
          </Button>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <SettingsCard title="NZBHydra2" tab="integrations" activeTab={settingsTab}>
          <LabeledInput label="URL" value={draft.nzbhydraUrl ?? ""} onChange={(value) => setDraft({ ...draft, nzbhydraUrl: value })} />
          <LabeledInput label="API key" value={draft.nzbhydraApiKey ?? ""} onChange={(value) => setDraft({ ...draft, nzbhydraApiKey: value })} />
          <LabeledInput label="Cache TTL" type="number" value={String(draft.nzbhydraCacheTtlSeconds)} onChange={(value) => setDraft({ ...draft, nzbhydraCacheTtlSeconds: Number(value) })} />
          <CheckboxLabel label="Backup working NZBs to nzb-backup/" checked={draft.backupNzbFiles} onChange={(checked) => setDraft({ ...draft, backupNzbFiles: checked })} />
        </SettingsCard>
        <SettingsCard title="Default Quality Profiles" tab="integrations" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">These profiles are used for automatic request searches unless a Seerr provider overrides them.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledSelect label="Default movie profile" value={draft.defaultMovieProfile ?? ""} onChange={(value) => setDraft({ ...draft, defaultMovieProfile: value })}>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Default TV profile" value={draft.defaultTvProfile ?? ""} onChange={(value) => setDraft({ ...draft, defaultTvProfile: value })}>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </LabeledSelect>
          </div>
        </SettingsCard>
        <SettingsCard title="Seerr" tab="providers" activeTab={settingsTab}>
          <div className="space-y-2">
            {(providers.data ?? []).map((provider) => (
              <div key={provider.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{provider.name}</p>
                    <Badge>{provider.type}</Badge>
                    <Badge>{provider.enabled ? "enabled" : "disabled"}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{provider.baseUrl}</p>
                  {provider.lastError ? <p className="text-xs text-destructive">{provider.lastError}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="icon" title="Test provider" onClick={() => testProvider.mutate(provider.id)}><Wifi className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={() => updateProvider.mutate({ id: provider.id, enabled: !provider.enabled })}>{provider.enabled ? "Disable" : "Enable"}</Button>
                  <Button variant="ghost" size="icon" title="Delete provider" onClick={() => deleteProvider.mutate(provider.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {testResult ? <p className="text-xs text-muted-foreground">{testResult}</p> : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Name" value={requestProvider.name} onChange={(value) => setRequestProvider({ ...requestProvider, name: value })} />
            <LabeledInput label="URL" value={requestProvider.baseUrl} onChange={(value) => setRequestProvider({ ...requestProvider, baseUrl: value })} />
            <LabeledInput label="API key" value={requestProvider.apiKey} onChange={(value) => setRequestProvider({ ...requestProvider, apiKey: value })} />
            <LabeledInput label="Sync minutes" type="number" value={String(requestProvider.syncIntervalMinutes)} onChange={(value) => setRequestProvider({ ...requestProvider, syncIntervalMinutes: Number(value) })} />
            <LabeledSelect label="Movie profile" value={requestProvider.defaultMovieProfile ?? ""} onChange={(value) => setRequestProvider({ ...requestProvider, defaultMovieProfile: value || undefined })}>
              <option value="">Use global default</option>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="TV profile" value={requestProvider.defaultTvProfile ?? ""} onChange={(value) => setRequestProvider({ ...requestProvider, defaultTvProfile: value || undefined })}>
              <option value="">Use global default</option>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </LabeledSelect>
            <CheckboxLabel label="Enabled" checked={requestProvider.enabled} onChange={(checked) => setRequestProvider({ ...requestProvider, enabled: checked })} />
          </div>
          <Button onClick={() => createProvider.mutate(requestProvider)} disabled={!requestProvider.name || !requestProvider.baseUrl || !requestProvider.apiKey}>
            <Plus className="mr-2 h-4 w-4" />Add request provider
          </Button>
        </SettingsCard>
        <SettingsCard title="Metadata" tab="integrations" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="TMDB API key" value={draft.tmdbApiKey ?? ""} onChange={(value) => setDraft({ ...draft, tmdbApiKey: value })} />
            <LabeledInput label="TVDB API key" value={draft.tvdbApiKey ?? ""} onChange={(value) => setDraft({ ...draft, tvdbApiKey: value })} />
            <LabeledInput label="Language" value={draft.metadataLanguage} onChange={(value) => setDraft({ ...draft, metadataLanguage: value || "en-US" })} />
            <LabeledInput label="Cache hours" type="number" value={String(draft.metadataCacheTtlHours)} onChange={(value) => setDraft({ ...draft, metadataCacheTtlHours: Number(value) || 168 })} />
          </div>
        </SettingsCard>
        <SettingsCard title="Usenet Providers" tab="providers" activeTab={settingsTab}>
          <div className="space-y-2">
            {(usenet.data ?? []).map((server) => (
              <div key={server.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{server.name}</p>
                    <Badge>{server.ssl ? "SSL" : "plain"}</Badge>
                    <Badge>{server.enabled ? "enabled" : "disabled"}</Badge>
                    {server.isBackup ? <Badge>backup</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{server.host}:{server.port} · {server.connections} connections · priority {server.priority}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" onClick={() => updateUsenet.mutate({ id: server.id, enabled: !server.enabled })}>{server.enabled ? "Disable" : "Enable"}</Button>
                  <Button variant="ghost" size="icon" title="Delete provider" onClick={() => deleteUsenet.mutate(server.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Name" value={usenetServer.name} onChange={(value) => setUsenetServer({ ...usenetServer, name: value })} />
            <LabeledInput label="Host" value={usenetServer.host} onChange={(value) => setUsenetServer({ ...usenetServer, host: value })} />
            <LabeledInput label="Port" type="number" value={String(usenetServer.port)} onChange={(value) => setUsenetServer({ ...usenetServer, port: Number(value) })} />
            <LabeledInput label="Connections" type="number" value={String(usenetServer.connections)} onChange={(value) => setUsenetServer({ ...usenetServer, connections: Number(value) })} />
            <LabeledInput label="Username" value={usenetServer.username ?? ""} onChange={(value) => setUsenetServer({ ...usenetServer, username: value })} />
            <LabeledInput label="Password" type="password" value={usenetServer.password ?? ""} onChange={(value) => setUsenetServer({ ...usenetServer, password: value })} />
            <LabeledInput label="Priority" type="number" value={String(usenetServer.priority)} onChange={(value) => setUsenetServer({ ...usenetServer, priority: Number(value) })} />
            <LabeledInput label="Retention days" type="number" value={usenetServer.retentionDays ? String(usenetServer.retentionDays) : ""} onChange={(value) => setUsenetServer({ ...usenetServer, retentionDays: value ? Number(value) : undefined })} />
            <CheckboxLabel label="SSL" checked={usenetServer.ssl} onChange={(checked) => setUsenetServer({ ...usenetServer, ssl: checked })} />
            <CheckboxLabel label="Enabled" checked={usenetServer.enabled} onChange={(checked) => setUsenetServer({ ...usenetServer, enabled: checked })} />
            <CheckboxLabel label="Backup server" checked={usenetServer.isBackup} onChange={(checked) => setUsenetServer({ ...usenetServer, isBackup: checked })} />
          </div>
          <Button onClick={() => createUsenet.mutate(usenetServer)} disabled={!usenetServer.name || !usenetServer.host}>
            <Plus className="mr-2 h-4 w-4" />Add Usenet provider
          </Button>
        </SettingsCard>
        <SettingsCard title="Paths" tab="system" activeTab={settingsTab}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Active downloads: <span className="font-mono text-foreground">/data/downloads</span></p>
            <p>Finished media: <span className="font-mono text-foreground">/data/completed</span></p>
            <p>Working NZBs: <span className="font-mono text-foreground">/data/nzb</span></p>
            <p>Optional NZB backups: <span className="font-mono text-foreground">/data/nzb-backup</span></p>
            <p>Plex / media clients: <span className="font-mono text-foreground">/mnt/media</span></p>
            <p>FUSE mountpoint: <span className="font-mono text-foreground">/mnt/fuse</span></p>
          </div>
        </SettingsCard>
        <SettingsCard title="Redis / PostgreSQL" tab="system" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Connection state is shown on the dashboard and health endpoint.</p>
        </SettingsCard>
        <SettingsCard title="Account" tab="system" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Username" value={profileDraft.username} onChange={(value) => setProfileDraft({ ...profileDraft, username: value })} />
            <LabeledInput label="Display name" value={profileDraft.displayName} onChange={(value) => setProfileDraft({ ...profileDraft, displayName: value })} />
            <LabeledInput label="Current password" type="password" value={passwordDraft.currentPassword} onChange={(value) => setPasswordDraft({ ...passwordDraft, currentPassword: value })} />
            <LabeledInput label="New password" type="password" value={passwordDraft.newPassword} onChange={(value) => setPasswordDraft({ ...passwordDraft, newPassword: value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              <Save className="mr-2 h-4 w-4" />Save account
            </Button>
            <Button variant="outline" onClick={() => savePassword.mutate()} disabled={savePassword.isPending || !passwordDraft.currentPassword || !passwordDraft.newPassword}>
              <Save className="mr-2 h-4 w-4" />Change password
            </Button>
            <Button variant="outline" onClick={() => void logout()}>Logout</Button>
          </div>
        </SettingsCard>
        <SettingsCard title="API Tokens" tab="system" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input value={tokenName} onChange={(event) => setTokenName(event.target.value)} placeholder="Frontend QA token" />
            <Button onClick={() => createToken.mutate()} disabled={!tokenName.trim() || createToken.isPending}>
              <Plus className="mr-2 h-4 w-4" />Create token
            </Button>
          </div>
          {createdToken ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              Copy now, this token is shown once: <span className="break-all font-semibold">{createdToken}</span>
            </div>
          ) : null}
          <div className="max-h-72 space-y-2 overflow-auto">
            {(authTokens.data?.tokens ?? []).map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{token.name}</p>
                  <p className="text-xs text-muted-foreground">Created {new Date(token.createdAt).toLocaleString()} · Last used {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "never"}</p>
                </div>
                <Button variant="ghost" size="icon" title="Revoke API token" onClick={() => deleteToken.mutate(token.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard title="Queue Management" tab="queue" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Streaming priority" type="number" value={String(policyDraft.streamingPriority)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamingPriority: Number(value) })} />
            <LabeledInput label="Max download connections" type="number" value={String(policyDraft.maxDownloadConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxDownloadConnections: Number(value) })} />
            <LabeledInput label="Max streaming connections" type="number" value={String(policyDraft.maxStreamingConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxStreamingConnections: Number(value) })} />
            <LabeledInput label="Max total connections" type="number" value={String(policyDraft.maxTotalUsenetConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxTotalUsenetConnections: Number(value) })} />
            <LabeledInput label="Stream chunk bytes" type="number" value={String(policyDraft.streamChunkSizeBytes)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamChunkSizeBytes: Number(value) })} />
            <LabeledInput label="Read-ahead bytes" type="number" value={String(policyDraft.streamReadAheadBytes)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamReadAheadBytes: Number(value) })} />
            <LabeledInput label="Memory cache max GB" type="number" value={String(policyDraft.streamCacheMaxSizeGb)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamCacheMaxSizeGb: Number(value) })} />
            <LabeledInput label="Memory cache max hours" type="number" value={String(policyDraft.streamCacheMaxAgeHours)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamCacheMaxAgeHours: Number(value) })} />
            <LabeledSelect label="Duplicate NZB" value={policyDraft.duplicateNzbBehavior} onChange={(value) => setPolicyDraft({ ...policyDraft, duplicateNzbBehavior: value as typeof policyDraft.duplicateNzbBehavior })}>
              <option value="mark_failed">Mark failed</option>
              <option value="ignore_existing">Ignore existing</option>
              <option value="download_again_with_suffix">Download again</option>
              <option value="replace_existing">Replace existing</option>
            </LabeledSelect>
            <LabeledSelect label="Import strategy" value={policyDraft.importStrategy} onChange={(value) => setPolicyDraft({ ...policyDraft, importStrategy: value as typeof policyDraft.importStrategy })}>
              <option value="symlink">Symlink</option>
              <option value="strm">STRM</option>
              <option value="copy">Copy</option>
            </LabeledSelect>
            <LabeledInput label="Manual upload category" value={policyDraft.manualUploadCategory} onChange={(value) => setPolicyDraft({ ...policyDraft, manualUploadCategory: value })} />
            <CheckboxLabel label="Memory stream cache" checked={policyDraft.streamCacheEnabled} onChange={(checked) => setPolicyDraft({ ...policyDraft, streamCacheEnabled: checked })} />
            <CheckboxLabel label="Fail NZBs without video" checked={policyDraft.failNzbWithoutVideo} onChange={(checked) => setPolicyDraft({ ...policyDraft, failNzbWithoutVideo: checked })} />
          </div>
          <div className="space-y-3 rounded-xl border bg-background/50 p-3">
            <h3 className="text-sm font-semibold">Import decision actions</h3>
            <p className="text-xs text-muted-foreground">Controls for what the queue should do when a grabbed release cannot be imported cleanly.</p>
            <div className="space-y-3">
              {queueDecisionRows.map(([key, label]) => (
                <label key={key} className="grid gap-2 text-sm md:grid-cols-[1fr_260px] md:items-center">
                  <span className="text-muted-foreground">{label}</span>
                  <Select
                    value={policyDraft.queueDecisionActions?.[key] ?? "do_nothing"}
                    onChange={(event) => setPolicyDraft({
                      ...policyDraft,
                      queueDecisionActions: { ...(policyDraft.queueDecisionActions ?? {}), [key]: event.target.value as keyof typeof queueDecisionLabels }
                    })}
                  >
                    {Object.entries(queueDecisionLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </Select>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => savePolicies.mutate(policyDraft)}><Save className="mr-2 h-4 w-4" />Save policies</Button>
        </SettingsCard>
        <SettingsCard title="Naming" tab="library" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Movie folder" value={namingDraft.movieFolderFormat} onChange={(value) => setNamingDraft({ ...namingDraft, movieFolderFormat: value })} />
            <LabeledInput label="Movie file" value={namingDraft.movieFileFormat} onChange={(value) => setNamingDraft({ ...namingDraft, movieFileFormat: value })} />
            <LabeledInput label="TV folder" value={namingDraft.tvFolderFormat} onChange={(value) => setNamingDraft({ ...namingDraft, tvFolderFormat: value })} />
            <LabeledInput label="Season folder" value={namingDraft.seasonFolderFormat} onChange={(value) => setNamingDraft({ ...namingDraft, seasonFolderFormat: value })} />
            <LabeledInput label="Episode file" value={namingDraft.episodeFileFormat} onChange={(value) => setNamingDraft({ ...namingDraft, episodeFileFormat: value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveNaming.mutate(namingDraft)}><Save className="mr-2 h-4 w-4" />Save naming</Button>
            <Button variant="outline" onClick={() => previewNaming.mutate()}>Preview</Button>
          </div>
          {namingPreview ? (
            <div className="space-y-1 rounded-md border p-3 text-xs text-muted-foreground">
              <p className="break-all">Completed: {namingPreview.completedPath}</p>
              <p className="break-all">Library: {namingPreview.libraryPath}</p>
            </div>
          ) : null}
        </SettingsCard>
        <SettingsCard title="Ignored Files" tab="rules" activeTab={settingsTab}>
          <textarea className="min-h-44 w-full rounded-md border bg-background p-3 text-sm" value={ignoredDraft} onChange={(event) => setIgnoredDraft(event.target.value)} />
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input value={ignoredTestPath} onChange={(event) => setIgnoredTestPath(event.target.value)} placeholder="/completed/Movie/sample.mkv" />
            <Button variant="outline" onClick={() => testIgnored.mutate(ignoredTestPath)} disabled={!ignoredTestPath}>Test</Button>
            <Button onClick={() => saveIgnored.mutate(ignoredDraft)}><Save className="mr-2 h-4 w-4" />Save</Button>
          </div>
          {ignoredTestResult ? <p className="text-xs text-muted-foreground">{ignoredTestResult}</p> : null}
        </SettingsCard>
        <SettingsCard title="Blocklist" tab="rules" activeTab={settingsTab}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input value={blockTitle} onChange={(event) => setBlockTitle(event.target.value)} placeholder="Release title" />
            <Button onClick={() => addBlock.mutate(blockTitle)} disabled={!blockTitle.trim()}><Plus className="mr-2 h-4 w-4" />Block</Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            {(blocklist.data ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.reason}{item.source ? ` · ${item.source}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" title="Delete blocklist item" onClick={() => deleteBlock.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard title="FUSE / SAB API" tab="system" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Drakkar mounts releases through FUSE at <span className="font-mono text-foreground">/mnt/fuse</span>, while Plex/library files live at <span className="font-mono text-foreground">/mnt/media</span>. SAB compatibility stays available for tools that push NZBs.</p>
        </SettingsCard>
      </section>
    </div>
  );
}

function SettingsCard({ title, children, tab, activeTab }: { title: string; children: ReactNode; tab: SettingsTab; activeTab: SettingsTab }) {
  if (tab !== activeTab) return null;
  return <Card className="space-y-3 p-4"><h2 className="text-sm font-semibold">{title}</h2>{children}</Card>;
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function LabeledSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>;
}

function CheckboxLabel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function cleanRequestProvider(provider: RequestProviderInput) {
  return {
    ...provider,
    baseUrl: provider.baseUrl.trim(),
    name: provider.name.trim(),
    apiKey: provider.apiKey.trim(),
    defaultMovieProfile: provider.defaultMovieProfile || undefined,
    defaultTvProfile: provider.defaultTvProfile || undefined,
    syncIntervalMinutes: Math.max(1, Number(provider.syncIntervalMinutes) || 15)
  };
}

function cleanUsenetServer(server: UsenetServerInput) {
  return {
    ...server,
    name: server.name.trim(),
    host: server.host.trim(),
    username: server.username?.trim() || undefined,
    password: server.password || undefined,
    port: Number(server.port) || (server.ssl ? 563 : 119),
    connections: Math.max(1, Number(server.connections) || 10),
    priority: Number(server.priority) || 0,
    retentionDays: server.retentionDays ? Number(server.retentionDays) : undefined
  };
}
