import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FolderTree, Library, Pencil, Play, PlugZap, Plus, RefreshCw, Save, ScrollText, Settings2, ShieldAlert, SlidersHorizontal, Trash2, Users, Wifi, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { api, type DrakkarApiTokenState, type RequestProvider, type RequestProviderInput, type Settings as SettingsType, type UsenetServer, type UsenetServerInput } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { useToast } from "../components/ToastProvider";
import { setFrontendApiToken } from "../config";
import { Logs } from "./Logs";
import { Profiles } from "./Profiles";

type SettingsTab = "integrations" | "providers" | "queue" | "library" | "rules" | "tasks" | "quality" | "logs" | "users" | "system";

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

const blockReasonOptions = [
  "manual",
  "duplicate_nzb",
  "no_video_content",
  "missing_articles",
  "repair_failed",
  "passworded_archive",
  "quality_rejected",
  "ignored_file_only",
  "unsupported_archive",
  "grab_failed",
  "import_failed"
] as const;

const settingsTabs: Array<{ value: SettingsTab; label: string; short: string; icon: typeof PlugZap }> = [
  { value: "integrations", label: "Integrations", short: "Apps", icon: PlugZap },
  { value: "providers", label: "Providers", short: "Feeds", icon: Wifi },
  { value: "queue", label: "Queue", short: "Queue", icon: Settings2 },
  { value: "library", label: "Library", short: "Names", icon: Library },
  { value: "rules", label: "Rules", short: "Rules", icon: ShieldAlert },
  { value: "tasks", label: "Tasks", short: "Tasks", icon: ClipboardList },
  { value: "quality", label: "Quality", short: "Quality", icon: SlidersHorizontal },
  { value: "logs", label: "Logs", short: "Logs", icon: ScrollText },
  { value: "users", label: "Users", short: "Users", icon: Users },
  { value: "system", label: "System", short: "System", icon: FolderTree }
];

function subtitleProviderOrder(primary: "subdl" | "opensubtitlescom") {
  return primary === "subdl" ? ["subdl", "opensubtitlescom"] as const : ["opensubtitlescom", "subdl"] as const;
}

const preferredDefaultProfiles = {
  movie: "Movie Standard",
  tv: "TV Standard"
} as const;

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user, setUser, logout } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const providers = useQuery({ queryKey: ["request-providers"], queryFn: api.requestProviders });
  const usenet = useQuery({ queryKey: ["usenet"], queryFn: api.usenetServers });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: api.tasks, refetchInterval: 5000 });
  const adminUsers = useQuery({ queryKey: ["admin-users"], queryFn: api.adminUsers, enabled: user?.isAdmin === true });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.profiles });
  const policies = useQuery({ queryKey: ["policies"], queryFn: api.policies });
  const ignoredFiles = useQuery({ queryKey: ["ignored-files"], queryFn: api.ignoredFiles });
  const [blockQuery, setBlockQuery] = useState("");
  const [blockReasonFilter, setBlockReasonFilter] = useState("all");
  const [blockStateFilter, setBlockStateFilter] = useState<"all" | "active" | "expired">("active");
  const blocklist = useQuery({
    queryKey: ["blocklist", blockQuery, blockReasonFilter, blockStateFilter],
    queryFn: () => api.blocklist({
      q: blockQuery || undefined,
      reason: blockReasonFilter === "all" ? undefined : blockReasonFilter,
      state: blockStateFilter,
      limit: 200
    })
  });
  const blocklistStats = useQuery({ queryKey: ["blocklist", "stats"], queryFn: api.blocklistStats });
  const naming = useQuery({ queryKey: ["naming"], queryFn: api.naming });
  const drakkarApiToken = useQuery({ queryKey: ["settings", "drakkar-api-token"], queryFn: api.drakkarApiToken, enabled: user?.isAdmin === true });
  const [draft, setDraft] = useState<SettingsType | null>(null);
  const initialTab = settingsTabs.some((tab) => tab.value === searchParams.get("tab"))
    ? searchParams.get("tab") as SettingsTab
    : "integrations";
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(initialTab);
  const [policyDraft, setPolicyDraft] = useState<Awaited<ReturnType<typeof api.policies>> | null>(null);
  const [showAdvancedQueue, setShowAdvancedQueue] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<RequestProviderInput | null>(null);
  const [editingUsenetId, setEditingUsenetId] = useState<string | null>(null);
  const [editingUsenet, setEditingUsenet] = useState<UsenetServerInput | null>(null);
  const [namingDraft, setNamingDraft] = useState<Awaited<ReturnType<typeof api.naming>> | null>(null);
  const [namingPreview, setNamingPreview] = useState<Awaited<ReturnType<typeof api.previewNaming>> | null>(null);
  const [ignoredDraft, setIgnoredDraft] = useState("");
  const [ignoredTestPath, setIgnoredTestPath] = useState("");
  const [ignoredTestResult, setIgnoredTestResult] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState({
    id: "",
    title: "",
    guid: "",
    reason: "manual",
    source: "settings",
    expiresAt: ""
  });
  const [requestProvider, setRequestProvider] = useState<RequestProviderInput>(defaultRequestProvider);
  const [usenetServer, setUsenetServer] = useState<UsenetServerInput>(defaultUsenetServer);
  const [profileDraft, setProfileDraft] = useState({ username: user?.username ?? "admin", displayName: user?.displayName ?? "admin" });
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: "", newPassword: "" });
  const [rotatedDrakkarApiToken, setRotatedDrakkarApiToken] = useState<string | null>(null);
  const [newUserDraft, setNewUserDraft] = useState({ username: "", displayName: "", password: "", isAdmin: false, mustChangePassword: true });
  const [resetPasswordDraft, setResetPasswordDraft] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [plexMessage, setPlexMessage] = useState<string | null>(null);
  const [plexPin, setPlexPin] = useState<{ pinId: number; code: string; authUrl: string } | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ["library"] });
      queryClient.invalidateQueries({ queryKey: ["symlinks"] });
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
    mutationFn: () => api.addBlocklistItem({
      title: blockForm.title,
      guid: blockForm.guid || undefined,
      reason: blockForm.reason,
      source: blockForm.source || undefined,
      expiresAt: blockForm.expiresAt ? new Date(blockForm.expiresAt).toISOString() : undefined
    }),
    onSuccess: () => {
      notify("Blocklist item added");
      setBlockForm({ id: "", title: "", guid: "", reason: "manual", source: "settings", expiresAt: "" });
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      queryClient.invalidateQueries({ queryKey: ["blocklist", "stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not add blocklist item")
  });
  const updateBlock = useMutation({
    mutationFn: () => api.updateBlocklistItem(blockForm.id, {
      title: blockForm.title || undefined,
      guid: blockForm.guid || null,
      reason: blockForm.reason,
      source: blockForm.source || null,
      expiresAt: blockForm.expiresAt ? new Date(blockForm.expiresAt).toISOString() : null
    }),
    onSuccess: () => {
      notify("Blocklist item updated");
      setBlockForm({ id: "", title: "", guid: "", reason: "manual", source: "settings", expiresAt: "" });
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      queryClient.invalidateQueries({ queryKey: ["blocklist", "stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update blocklist item")
  });
  const deleteBlock = useMutation({
    mutationFn: (id: string) => api.deleteBlocklistItem(id),
    onSuccess: () => {
      notify("Blocklist item removed");
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      queryClient.invalidateQueries({ queryKey: ["blocklist", "stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not remove blocklist item")
  });
  const cleanupExpiredBlocklist = useMutation({
    mutationFn: () => api.cleanupExpiredBlocklistItems(),
    onSuccess: (result) => {
      notify(`Removed ${result.deleted} expired blocklist item${result.deleted === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      queryClient.invalidateQueries({ queryKey: ["blocklist", "stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not clean expired blocklist items")
  });
  const clearBlocklist = useMutation({
    mutationFn: () => api.clearBlocklistItems(),
    onSuccess: (result) => {
      notify(`Cleared ${result.deleted} blocklist item${result.deleted === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      queryClient.invalidateQueries({ queryKey: ["blocklist", "stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not clear blocklist")
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
    mutationFn: ({ id, data }: { id: string; data: Partial<RequestProviderInput> }) => api.updateRequestProvider(id, data),
    onSuccess: () => {
      notify("Seerr provider updated");
      setEditingProviderId(null);
      setEditingProvider(null);
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
    mutationFn: ({ id, data }: { id: string; data: Partial<UsenetServerInput> }) => api.updateUsenetServer(id, data),
    onSuccess: () => {
      notify("Usenet provider updated");
      setEditingUsenetId(null);
      setEditingUsenet(null);
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
  const rotateDrakkarApiToken = useMutation({
    mutationFn: () => api.rotateDrakkarApiToken(),
    onSuccess: (result: DrakkarApiTokenState) => {
      setFrontendApiToken(result.drakkarApiToken);
      setRotatedDrakkarApiToken(result.drakkarApiToken);
      queryClient.setQueryData(["settings", "drakkar-api-token"], result);
      notify("Drakkar API token rotated", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not rotate Drakkar API token", "error")
  });
  const createAdminUser = useMutation({
    mutationFn: () => api.createAdminUser(newUserDraft),
    onSuccess: () => {
      notify("User created");
      setNewUserDraft({ username: "", displayName: "", password: "", isAdmin: false, mustChangePassword: true });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not create user")
  });
  const updateAdminUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { username?: string; displayName?: string; isAdmin?: boolean; mustChangePassword?: boolean } }) =>
      api.updateAdminUser(id, payload),
    onSuccess: () => {
      notify("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not update user")
  });
  const resetAdminPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api.resetAdminUserPassword(id, password),
    onSuccess: (_, variables) => {
      setResetPasswordDraft((current) => ({ ...current, [variables.id]: "" }));
      notify("Password reset");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not reset password")
  });
  const deleteAdminUser = useMutation({
    mutationFn: (id: string) => api.deleteAdminUser(id),
    onSuccess: () => {
      notify("User deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not delete user")
  });
  const resetEnvironment = useMutation({
    mutationFn: () => api.resetEnvironment(),
    onSuccess: () => {
      notify("Environment cleared");
      queryClient.invalidateQueries();
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not clear environment")
  });
  const testPlex = useMutation({
    mutationFn: () => api.plexTest(),
    onSuccess: (result) => setPlexMessage(`Connected. ${result.libraries.length} Plex libraries found.`),
    onError: (error) => setPlexMessage(error instanceof Error ? error.message : "Plex test failed")
  });
  const startPlexOauth = useMutation({
    mutationFn: () => api.plexOauthStart(),
    onSuccess: (result) => {
      setPlexPin(result);
      window.open(result.authUrl, "_blank", "noopener,noreferrer");
      setPlexMessage(`Plex PIN ${result.code} opened in new tab. Approve it; Drakkar will detect the token automatically.`);
    },
    onError: (error) => setPlexMessage(error instanceof Error ? error.message : "Could not start Plex OAuth")
  });
  const pollPlexOauth = useMutation({
    mutationFn: (pinId: number) => api.plexOauthPoll(pinId),
    onSuccess: (result) => {
      if (!result.authorized) {
        setPlexMessage("Plex PIN not approved yet.");
        return;
      }
      setPlexMessage("Plex token saved.");
      setPlexPin(null);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => setPlexMessage(error instanceof Error ? error.message : "Could not poll Plex OAuth")
  });

  useEffect(() => {
    if (!settings.data) return;
    const profileNames = profiles.data?.map((profile) => profile.name) ?? [];
    setDraft({
      ...settings.data,
      defaultMovieProfile: resolveDefaultProfileValue(profileNames, settings.data.defaultMovieProfile, preferredDefaultProfiles.movie),
      defaultTvProfile: resolveDefaultProfileValue(profileNames, settings.data.defaultTvProfile, preferredDefaultProfiles.tv)
    });
  }, [settings.data, profiles.data]);
  useEffect(() => {
    if (policies.data) setPolicyDraft(policies.data);
  }, [policies.data]);
  useEffect(() => {
    if (ignoredFiles.data) setIgnoredDraft(ignoredFiles.data.join("\n"));
  }, [ignoredFiles.data]);
  useEffect(() => {
    if (!plexPin) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api.plexOauthPoll(plexPin.pinId);
        if (cancelled || !result.authorized) return;
        setPlexMessage("Plex token saved.");
        setPlexPin(null);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
      } catch {
        // Keep polling until Plex approves the PIN or the user leaves this page.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [plexPin, queryClient]);
  useEffect(() => {
    if (naming.data) setNamingDraft(naming.data);
  }, [naming.data]);

  function beginEditUsenet(server: UsenetServer) {
    setEditingUsenetId(server.id);
    setEditingUsenet({
      name: server.name,
      host: server.host,
      port: server.port,
      ssl: server.ssl,
      username: server.username ?? "",
      password: "",
      connections: server.connections,
      priority: server.priority,
      enabled: server.enabled,
      isBackup: server.isBackup,
      retentionDays: server.retentionDays ?? undefined
    });
  }

  function beginEditProvider(provider: RequestProvider) {
    setEditingProviderId(provider.id);
    setEditingProvider({
      type: provider.type,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: "",
      enabled: provider.enabled,
      syncIntervalMinutes: provider.syncIntervalMinutes,
      defaultMovieProfile: provider.defaultMovieProfile ?? undefined,
      defaultTvProfile: provider.defaultTvProfile ?? undefined
    });
  }
  useEffect(() => {
    if (user) setProfileDraft({ username: user.username, displayName: user.displayName });
  }, [user]);

  if (settings.isLoading || policies.isLoading || naming.isLoading || !draft || !policyDraft || !namingDraft) return <LoadingState />;
  if (settings.isError) return <ErrorState message="Could not load settings." />;

  const totalConnectionBudget = Math.max(0, Number(policyDraft.maxTotalUsenetConnections) || 0);
  const downloadConnectionBudget = Math.max(0, Number(policyDraft.maxDownloadConnections) || 0);
  const streamingConnectionBudget = Math.max(0, Number(policyDraft.maxStreamingConnections) || 0);
  const usedConnectionBudget = downloadConnectionBudget + streamingConnectionBudget;
  const overConnectionBudget = usedConnectionBudget > totalConnectionBudget;
  const streamingReserve = policyDraft.streamingPriority > 0 ? Math.max(1, Math.floor(totalConnectionBudget * (policyDraft.streamingPriority / 100))) : 0;
  const queueWhileStreaming = Math.min(downloadConnectionBudget, Math.max(0, totalConnectionBudget - streamingReserve));
  const applyQueuePreset = (preset: "balanced" | "streaming" | "downloads") => {
    const total = Math.max(1, totalConnectionBudget);
    if (preset === "streaming") {
      const streaming = Math.min(total, Math.max(12, Math.ceil(total * 0.45)));
      setPolicyDraft({ ...policyDraft, streamingPriority: 78, maxStreamingConnections: streaming, maxDownloadConnections: Math.max(4, total - streaming) });
      return;
    }
    if (preset === "downloads") {
      const streaming = Math.min(total, Math.max(8, Math.ceil(total * 0.25)));
      setPolicyDraft({ ...policyDraft, streamingPriority: 60, maxStreamingConnections: streaming, maxDownloadConnections: Math.max(6, total - streaming) });
      return;
    }
    const streaming = Math.min(total, Math.max(10, Math.ceil(total * 0.35)));
    setPolicyDraft({ ...policyDraft, streamingPriority: 70, maxStreamingConnections: streaming, maxDownloadConnections: Math.max(6, total - streaming) });
  };
  const wideSettingsTab = settingsTab === "quality" || settingsTab === "logs";

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

      <div className="grid grid-cols-3 gap-2 rounded-3xl border bg-card/90 p-2 sm:grid-cols-5 xl:grid-cols-10">
        {settingsTabs.map((tab) => (
          <Button
            key={tab.value}
            className="h-auto min-w-0 flex-col gap-1 px-2 py-2 text-[11px] sm:text-sm"
            variant={settingsTab === tab.value ? "default" : "ghost"}
            onClick={() => {
              setSettingsTab(tab.value);
              setSearchParams({ tab: tab.value });
            }}
            title={tab.label}
          >
            <tab.icon className="h-4 w-4" />
            <span className="truncate sm:hidden">{tab.short}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </Button>
        ))}
      </div>

      <section className={`grid gap-4 ${wideSettingsTab ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
        <SettingsCard title="NZBHydra2" tab="integrations" activeTab={settingsTab}>
          <LabeledInput label="URL" value={draft.nzbhydraUrl ?? ""} onChange={(value) => setDraft({ ...draft, nzbhydraUrl: value })} />
          <LabeledInput label="API key" value={draft.nzbhydraApiKey ?? ""} onChange={(value) => setDraft({ ...draft, nzbhydraApiKey: value })} />
          <LabeledInput label="Search cache TTL" type="number" value={String(draft.nzbhydraCacheTtlSeconds)} onChange={(value) => setDraft({ ...draft, nzbhydraCacheTtlSeconds: Number(value) })} />
          <LabeledInput label="RSS/update cache TTL" type="number" value={String(draft.nzbhydraFeedCacheTtlSeconds)} onChange={(value) => setDraft({ ...draft, nzbhydraFeedCacheTtlSeconds: Number(value) })} />
          <LabeledInput label="RSS/update max results" type="number" value={String(draft.nzbhydraFeedMaxResults ?? 1200)} onChange={(value) => setDraft({ ...draft, nzbhydraFeedMaxResults: Number(value) || 1200 })} />
          <CheckboxLabel label="Backup working NZBs to nzb-backup/" checked={draft.backupNzbFiles} onChange={(checked) => setDraft({ ...draft, backupNzbFiles: checked })} />
        </SettingsCard>
        <SettingsCard title="Default Quality Profiles" tab="integrations" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">These profiles are used for automatic request searches unless a Seerr provider overrides them.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledSelect label="Default movie profile" value={draft.defaultMovieProfile ?? ""} onChange={(value) => setDraft({ ...draft, defaultMovieProfile: value })}>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="Default TV profile" value={draft.defaultTvProfile ?? ""} onChange={(value) => setDraft({ ...draft, defaultTvProfile: value })}>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
            </LabeledSelect>
          </div>
        </SettingsCard>
        <SettingsCard title="Plex" tab="integrations" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Targeted refresh scans only the added file/folder path after import, not whole library.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Plex server URL" value={draft.plexServerUrl ?? ""} onChange={(value) => setDraft({ ...draft, plexServerUrl: value })} />
            <LabeledInput label="Plex token" type="password" value={draft.plexToken ?? ""} onChange={(value) => setDraft({ ...draft, plexToken: value })} />
            <LabeledInput label="Plex library path" value={draft.plexLibraryPath ?? "/mnt/drakkar/media"} onChange={(value) => setDraft({ ...draft, plexLibraryPath: value || "/mnt/drakkar/media" })} />
            <LabeledInput label="Section ID (optional)" value={draft.plexSectionId ?? ""} onChange={(value) => setDraft({ ...draft, plexSectionId: value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => testPlex.mutate()} disabled={testPlex.isPending}>Test Plex</Button>
            <Button variant="outline" onClick={() => startPlexOauth.mutate()} disabled={startPlexOauth.isPending}>Get token with Plex</Button>
            {plexPin ? <Button variant="outline" onClick={() => pollPlexOauth.mutate(plexPin.pinId)} disabled={pollPlexOauth.isPending}>Poll PIN {plexPin.code}</Button> : null}
          </div>
          {plexPin ? (
            <a className="block text-xs font-semibold text-primary underline" href={plexPin.authUrl} target="_blank" rel="noreferrer">
              Open Plex auth page for PIN {plexPin.code}
            </a>
          ) : null}
          {plexMessage ? <p className="text-xs text-muted-foreground">{plexMessage}</p> : null}
        </SettingsCard>
        <SettingsCard title="Seerr" tab="providers" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Webhooks handle normal request updates. Drakkar does one full Seerr import at startup, and you can still run a manual full sync from Tasks.</p>
          <div className="space-y-2">
            {(providers.data ?? []).map((provider) => (
              <div key={provider.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
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
                    <Button variant="outline" onClick={() => beginEditProvider(provider)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                    <Button variant="outline" onClick={() => updateProvider.mutate({ id: provider.id, data: { enabled: !provider.enabled } })}>{provider.enabled ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="icon" title="Delete provider" onClick={() => deleteProvider.mutate(provider.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {editingProviderId === provider.id && editingProvider ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <LabeledInput label="Name" value={editingProvider.name} onChange={(value) => setEditingProvider({ ...editingProvider, name: value })} />
                      <LabeledInput label="URL" value={editingProvider.baseUrl} onChange={(value) => setEditingProvider({ ...editingProvider, baseUrl: value })} />
                      <LabeledInput label="API key" value={editingProvider.apiKey} onChange={(value) => setEditingProvider({ ...editingProvider, apiKey: value })} />
                      <LabeledInput label="Sync minutes" type="number" value={String(editingProvider.syncIntervalMinutes)} onChange={(value) => setEditingProvider({ ...editingProvider, syncIntervalMinutes: Number(value) })} />
                      <LabeledSelect label="Movie profile" value={editingProvider.defaultMovieProfile ?? ""} onChange={(value) => setEditingProvider({ ...editingProvider, defaultMovieProfile: value || undefined })}>
                        <option value="">Use global default</option>
                        {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
                      </LabeledSelect>
                      <LabeledSelect label="TV profile" value={editingProvider.defaultTvProfile ?? ""} onChange={(value) => setEditingProvider({ ...editingProvider, defaultTvProfile: value || undefined })}>
                        <option value="">Use global default</option>
                        {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
                      </LabeledSelect>
                      <CheckboxLabel label="Enabled" checked={editingProvider.enabled} onChange={(checked) => setEditingProvider({ ...editingProvider, enabled: checked })} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => updateProvider.mutate({ id: provider.id, data: cleanRequestProviderUpdate(editingProvider) })}
                        disabled={!editingProvider.name.trim() || !editingProvider.baseUrl.trim() || updateProvider.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />Save provider
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingProviderId(null); setEditingProvider(null); }}>
                        <X className="mr-2 h-4 w-4" />Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Leave API key blank to keep existing key.</p>
                  </>
                ) : null}
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
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
            </LabeledSelect>
            <LabeledSelect label="TV profile" value={requestProvider.defaultTvProfile ?? ""} onChange={(value) => setRequestProvider({ ...requestProvider, defaultTvProfile: value || undefined })}>
              <option value="">Use global default</option>
              {(profiles.data ?? []).map((profile) => <option key={profile.id} value={profile.name}>{profile.name}</option>)}
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
        <SettingsCard title="Subtitles" tab="integrations" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Built-in sidecar subtitle downloader. Drakkar writes normal <code>.srt</code> files next to the movie or episode link after import and during backfill. Providers are used in order and only remaining missing languages fall through to the next provider.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <CheckboxLabel label="Enable built-in subtitles" checked={draft.subtitlesEnabled} onChange={(checked) => setDraft({ ...draft, subtitlesEnabled: checked })} />
            <LabeledSelect
              label="Primary provider"
              value={draft.subtitleProviderOrder?.[0] ?? "subdl"}
              onChange={(value) => setDraft({
                ...draft,
                subtitlesProvider: value as "subdl" | "opensubtitlescom",
                subtitleProviderOrder: [...subtitleProviderOrder(value as "subdl" | "opensubtitlescom")]
              })}
            >
              <option value="subdl">SubDL</option>
              <option value="opensubtitlescom">OpenSubtitles.com</option>
            </LabeledSelect>
            <LabeledInput
              label="Languages"
              value={(draft.subtitleLanguages ?? []).join(",")}
              onChange={(value) => setDraft({
                ...draft,
                subtitleLanguages: value.split(/[,\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean)
              })}
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold">SubDL</p>
                <CheckboxLabel
                  label="Enabled"
                  checked={draft.subtitleProviders.subdl.enabled}
                  onChange={(checked) => setDraft({
                    ...draft,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      subdl: { ...draft.subtitleProviders.subdl, enabled: checked }
                    }
                  })}
                />
              </div>
              <div className="grid gap-2">
                <LabeledInput
                  label="SubDL API key"
                  type="password"
                  value={draft.subtitleProviders.subdl.apiKey ?? ""}
                  onChange={(value) => setDraft({
                    ...draft,
                    subtitlesApiKey: draft.subtitlesProvider === "subdl" ? value : draft.subtitlesApiKey,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      subdl: { ...draft.subtitleProviders.subdl, apiKey: value }
                    }
                  })}
                />
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold">OpenSubtitles.com</p>
                <CheckboxLabel
                  label="Enabled"
                  checked={draft.subtitleProviders.opensubtitlescom.enabled}
                  onChange={(checked) => setDraft({
                    ...draft,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      opensubtitlescom: { ...draft.subtitleProviders.opensubtitlescom, enabled: checked }
                    }
                  })}
                />
              </div>
              <div className="grid gap-2">
                <LabeledInput
                  label="API key"
                  type="password"
                  value={draft.subtitleProviders.opensubtitlescom.apiKey ?? ""}
                  onChange={(value) => setDraft({
                    ...draft,
                    subtitlesApiKey: draft.subtitlesProvider === "opensubtitlescom" ? value : draft.subtitlesApiKey,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      opensubtitlescom: { ...draft.subtitleProviders.opensubtitlescom, apiKey: value }
                    }
                  })}
                />
                <LabeledInput
                  label="Username"
                  value={draft.subtitleProviders.opensubtitlescom.username ?? ""}
                  onChange={(value) => setDraft({
                    ...draft,
                    subtitlesUsername: value,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      opensubtitlescom: { ...draft.subtitleProviders.opensubtitlescom, username: value }
                    }
                  })}
                />
                <LabeledInput
                  label="Password"
                  type="password"
                  value={draft.subtitleProviders.opensubtitlescom.password ?? ""}
                  onChange={(value) => setDraft({
                    ...draft,
                    subtitlesPassword: value,
                    subtitleProviders: {
                      ...draft.subtitleProviders,
                      opensubtitlescom: { ...draft.subtitleProviders.opensubtitlescom, password: value }
                    }
                  })}
                />
              </div>
            </div>
          </div>
        </SettingsCard>
        <SettingsCard title="Usenet Providers" tab="providers" activeTab={settingsTab}>
          <div className="space-y-2">
            {(usenet.data ?? []).map((server) => (
              <div key={server.id} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
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
                    <Button variant="outline" onClick={() => beginEditUsenet(server)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                    <Button variant="outline" onClick={() => updateUsenet.mutate({ id: server.id, data: { enabled: !server.enabled } })}>{server.enabled ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="icon" title="Delete provider" onClick={() => deleteUsenet.mutate(server.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {editingUsenetId === server.id && editingUsenet ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <LabeledInput label="Name" value={editingUsenet.name} onChange={(value) => setEditingUsenet({ ...editingUsenet, name: value })} />
                      <LabeledInput label="Host" value={editingUsenet.host} onChange={(value) => setEditingUsenet({ ...editingUsenet, host: value })} />
                      <LabeledInput label="Port" type="number" value={String(editingUsenet.port)} onChange={(value) => setEditingUsenet({ ...editingUsenet, port: Number(value) })} />
                      <LabeledInput label="Connections" type="number" value={String(editingUsenet.connections)} onChange={(value) => setEditingUsenet({ ...editingUsenet, connections: Number(value) })} />
                      <LabeledInput label="Username" value={editingUsenet.username ?? ""} onChange={(value) => setEditingUsenet({ ...editingUsenet, username: value })} />
                      <LabeledInput label="Password" type="password" value={editingUsenet.password ?? ""} onChange={(value) => setEditingUsenet({ ...editingUsenet, password: value })} />
                      <LabeledInput label="Priority" type="number" value={String(editingUsenet.priority)} onChange={(value) => setEditingUsenet({ ...editingUsenet, priority: Number(value) })} />
                      <LabeledInput label="Retention days" type="number" value={editingUsenet.retentionDays ? String(editingUsenet.retentionDays) : ""} onChange={(value) => setEditingUsenet({ ...editingUsenet, retentionDays: value ? Number(value) : undefined })} />
                      <CheckboxLabel label="SSL" checked={editingUsenet.ssl} onChange={(checked) => setEditingUsenet({ ...editingUsenet, ssl: checked })} />
                      <CheckboxLabel label="Enabled" checked={editingUsenet.enabled} onChange={(checked) => setEditingUsenet({ ...editingUsenet, enabled: checked })} />
                      <CheckboxLabel label="Backup server" checked={editingUsenet.isBackup} onChange={(checked) => setEditingUsenet({ ...editingUsenet, isBackup: checked })} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => updateUsenet.mutate({ id: server.id, data: cleanUsenetServer(editingUsenet) })}
                        disabled={!editingUsenet.name.trim() || !editingUsenet.host.trim() || updateUsenet.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />Save provider
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingUsenetId(null); setEditingUsenet(null); }}>
                        <X className="mr-2 h-4 w-4" />Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Leave password blank to keep existing password.</p>
                  </>
                ) : null}
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
            <p>Streamable content: <span className="font-mono text-foreground">/mnt/drakkar/vfs/content</span></p>
            <p>Completed symlink feed: <span className="font-mono text-foreground">/mnt/drakkar/vfs/completed-symlinks</span></p>
            <p>Working NZBs: <span className="font-mono text-foreground">/mnt/drakkar/vfs/nzbs</span></p>
            <p>Optional NZB backups: <span className="font-mono text-foreground">/data/nzb-backup</span></p>
            <p>Plex / media clients: <span className="font-mono text-foreground">/mnt/drakkar/media</span></p>
            <p>VFS mountpoint: <span className="font-mono text-foreground">/mnt/drakkar/vfs</span></p>
          </div>
        </SettingsCard>
        <SettingsCard title="Redis / PostgreSQL" tab="system" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Connection state is shown on the dashboard and health endpoint.</p>
        </SettingsCard>
        <SettingsCard title="Account" tab="users" activeTab={settingsTab}>
          {user?.mustChangePassword ? (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              This account is still using the bootstrap password. Change it now before using the rest of Drakkar.
            </div>
          ) : null}
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
        <SettingsCard title="Drakkar API Token" tab="system" activeTab={settingsTab}>
          {user?.isAdmin ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                This is the one shared Drakkar API token from <code>settings.json</code>. Frontend requests and external API access can use this same token.
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input
                  value={rotatedDrakkarApiToken ?? drakkarApiToken.data?.drakkarApiToken ?? ""}
                  readOnly
                  placeholder="Drakkar API token"
                />
                <Button onClick={() => rotateDrakkarApiToken.mutate()} disabled={rotateDrakkarApiToken.isPending}>
                  <Save className="mr-2 h-4 w-4" />Regenerate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Regenerating updates <code>/data/config/settings.json</code> and this browser session immediately. Send it as <code>x-api-token</code>. Bearer auth with the same token also works.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Admin access required to view or rotate the shared Drakkar API token.</p>
          )}
        </SettingsCard>
        <SettingsCard title="Queue Management" tab="queue" activeTab={settingsTab}>
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
            Total connections come from enabled Usenet providers. WebDAV + rclone playback stays protected, while downloads use the remaining headroom instead of fully pausing.
          </div>
          <div className={`grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-4 ${overConnectionBudget ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border/60 bg-background/50 text-foreground"}`}>
            <MetricCard label="Provider total" value={String(totalConnectionBudget)} />
            <MetricCard label="Queue max" value={String(downloadConnectionBudget)} />
            <MetricCard label="Stream max" value={String(streamingConnectionBudget)} />
            <MetricCard label="Queue while streaming" value={String(queueWhileStreaming)} />
            {overConnectionBudget ? <p className="mt-2 text-xs font-medium">Over budget by {usedConnectionBudget - totalConnectionBudget}. Backend will clamp values on save.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => applyQueuePreset("balanced")}>Balanced</Button>
            <Button variant="outline" onClick={() => applyQueuePreset("streaming")}>Streaming first</Button>
            <Button variant="outline" onClick={() => applyQueuePreset("downloads")}>Download first</Button>
            <Button variant="ghost" onClick={() => setShowAdvancedQueue((value) => !value)}>{showAdvancedQueue ? "Hide advanced" : "Show advanced"}</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Streaming priority" type="number" value={String(policyDraft.streamingPriority)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamingPriority: Number(value) })} />
            <LabeledInput label="Max download connections" type="number" value={String(policyDraft.maxDownloadConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxDownloadConnections: Number(value) })} />
            <LabeledInput label="Max streaming connections" type="number" value={String(policyDraft.maxStreamingConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxStreamingConnections: Number(value) })} />
            <LabeledInput label="Max total connections" type="number" value={String(policyDraft.maxTotalUsenetConnections)} onChange={(value) => setPolicyDraft({ ...policyDraft, maxTotalUsenetConnections: Number(value) })} disabled />
            <LabeledInput label="Queue seed target" type="number" value={String(draft.monitorQueueSeedTarget ?? 12)} onChange={(value) => setDraft({ ...draft, monitorQueueSeedTarget: Number(value) || 12 })} />
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
            <CheckboxLabel label="Fail NZBs without video" checked={policyDraft.failNzbWithoutVideo} onChange={(checked) => setPolicyDraft({ ...policyDraft, failNzbWithoutVideo: checked })} />
          </div>
          {showAdvancedQueue ? (
            <div className="grid gap-2 rounded-xl border bg-background/50 p-3 md:grid-cols-2">
              <LabeledInput label="Stream chunk bytes" type="number" value={String(policyDraft.streamChunkSizeBytes)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamChunkSizeBytes: Number(value) })} />
              <LabeledInput label="Read-ahead bytes" type="number" value={String(policyDraft.streamReadAheadBytes)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamReadAheadBytes: Number(value) })} />
              <LabeledInput label="Memory cache max GB" type="number" value={String(policyDraft.streamCacheMaxSizeGb)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamCacheMaxSizeGb: Number(value) })} />
              <LabeledInput label="Memory cache max hours" type="number" value={String(policyDraft.streamCacheMaxAgeHours)} onChange={(value) => setPolicyDraft({ ...policyDraft, streamCacheMaxAgeHours: Number(value) })} />
              <LabeledInput label="Manual upload category" value={policyDraft.manualUploadCategory} onChange={(value) => setPolicyDraft({ ...policyDraft, manualUploadCategory: value })} />
              <CheckboxLabel label="Memory stream cache" checked={policyDraft.streamCacheEnabled} onChange={(checked) => setPolicyDraft({ ...policyDraft, streamCacheEnabled: checked })} />
            </div>
          ) : null}
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
          <div className="grid gap-2 md:grid-cols-4">
            <MetricCard label="Total" value={String(blocklistStats.data?.total ?? 0)} />
            <MetricCard label="Active" value={String(blocklistStats.data?.active ?? 0)} />
            <MetricCard label="Expired" value={String(blocklistStats.data?.expired ?? 0)} />
            <MetricCard label="Top reason" value={topCountLabel(blocklistStats.data?.reasons)} />
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            <Input value={blockForm.title} onChange={(event) => setBlockForm({ ...blockForm, title: event.target.value })} placeholder="Release title" />
            <Input value={blockForm.guid} onChange={(event) => setBlockForm({ ...blockForm, guid: event.target.value })} placeholder="GUID optional" />
            <Select value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })}>
              {blockReasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
            <Input value={blockForm.source} onChange={(event) => setBlockForm({ ...blockForm, source: event.target.value })} placeholder="Source optional" />
            <Input type="datetime-local" value={blockForm.expiresAt} onChange={(event) => setBlockForm({ ...blockForm, expiresAt: event.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => addBlock.mutate()} disabled={!blockForm.title.trim() || !!blockForm.id}><Plus className="mr-2 h-4 w-4" />Block</Button>
            <Button variant="outline" onClick={() => updateBlock.mutate()} disabled={!blockForm.id || !blockForm.title.trim()}><Save className="mr-2 h-4 w-4" />Update</Button>
            <Button variant="outline" onClick={() => setBlockForm({ id: "", title: "", guid: "", reason: "manual", source: "settings", expiresAt: "" })} disabled={!blockForm.id && !blockForm.title && !blockForm.guid && blockForm.reason === "manual" && blockForm.source === "settings" && !blockForm.expiresAt}><X className="mr-2 h-4 w-4" />Clear</Button>
            <Button variant="outline" onClick={() => cleanupExpiredBlocklist.mutate()} disabled={cleanupExpiredBlocklist.isPending}>Clean expired</Button>
            <Button
              variant="outline"
              className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              onClick={() => {
                if (!window.confirm("Clear only the blocklist? Downloads, library, and settings stay untouched.")) return;
                clearBlocklist.mutate();
              }}
              disabled={clearBlocklist.isPending || (blocklistStats.data?.total ?? 0) === 0}
            >
              Clear blocklist only
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_160px]">
            <Input value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} placeholder="Search title or GUID" />
            <Select value={blockReasonFilter} onChange={(event) => setBlockReasonFilter(event.target.value)}>
              <option value="all">All reasons</option>
              {blockReasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
            <Select value={blockStateFilter} onChange={(event) => setBlockStateFilter(event.target.value as "all" | "active" | "expired")}>
              <option value="active">Active only</option>
              <option value="all">All states</option>
              <option value="expired">Expired only</option>
            </Select>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {(blocklist.data ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.reason}
                    {item.source ? ` · ${item.source}` : ""}
                    {item.guid ? ` · ${item.guid}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.expired ? "Expired" : "Active"}
                    {item.expiresAt ? ` · expires ${formatDateTime(item.expiresAt)}` : " · no expiry"}
                    {item.createdAt ? ` · added ${formatDateTime(item.createdAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit blocklist item"
                    onClick={() => setBlockForm({
                      id: item.id,
                      title: item.title,
                      guid: item.guid ?? "",
                      reason: item.reason,
                      source: item.source ?? "",
                      expiresAt: item.expiresAt ? toDateTimeLocalValue(item.expiresAt) : ""
                    })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Delete blocklist item" onClick={() => deleteBlock.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard title="Task Intervals" tab="tasks" activeTab={settingsTab}>
          <p className="text-sm text-muted-foreground">Leave a field empty to use the built-in schedule. Values are saved in minutes and applied to the next task cycle automatically.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(tasks.data?.tasks ?? []).map((task) => (
              <div key={task.id} className="rounded-2xl border border-border/80 bg-background/60 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{task.name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description}</p>
                  </div>
                  <Button
                    className="shrink-0"
                    variant="outline"
                    size="icon"
                    disabled={!task.manualRunnable || task.status === "running"}
                    onClick={() => {
                      api.runTask(task.id)
                        .then((result) => {
                          if (result.skipped) {
                            notify(
                              result.reason === "already_running"
                                ? `${task.name} already running`
                                : result.reason === "conflicting_task_running"
                                  ? "Another library task is already running"
                                  : `${task.name} skipped`
                            );
                          } else {
                            notify(`${task.name} queued`);
                          }
                        })
                        .catch((error) => notify(error instanceof Error ? error.message : "Could not start task"))
                        .finally(() => {
                          void tasks.refetch();
                          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
                        });
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <LabeledInput
                    label="Custom interval minutes"
                    type="number"
                    value={draft.taskIntervals?.[task.id] ? String(Math.round((draft.taskIntervals[task.id] ?? 0) / 60000)) : ""}
                    onChange={(value) => {
                      const taskIntervals = { ...(draft.taskIntervals ?? {}) };
                      if (value.trim()) {
                        taskIntervals[task.id] = Math.max(1, Number(value) || 0) * 60_000;
                      } else {
                        delete taskIntervals[task.id];
                      }
                      setDraft({
                        ...draft,
                        taskIntervals
                      });
                    }}
                  />
                  <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-xs font-medium text-muted-foreground md:mb-0.5">
                    Effective now: {formatInterval(task.intervalMs)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard title="Live Task Status" tab="tasks" activeTab={settingsTab}>
          <div className="space-y-2">
            {(tasks.data?.tasks ?? []).map((task) => (
              <div key={`${task.id}-status`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/60 px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{task.name}</p>
                    <Badge className={taskStatusClassName(task.status)}>{task.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Last {formatTaskDate(task.lastCompletedAt ?? task.lastStartedAt, "Never")} · Next {task.enabled ? formatTaskDate(task.nextRunAt, task.intervalMs ? "Pending" : "Manual") : "Disabled"}</p>
                  {task.lastError ? <p className="mt-1 text-xs text-destructive">{task.lastError}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    className="shrink-0"
                    variant="outline"
                    size="icon"
                    disabled={!task.manualRunnable || task.status === "running"}
                    onClick={() => {
                      api.runTask(task.id)
                        .then((result) => {
                          if (result.skipped) {
                            notify(
                              result.reason === "already_running"
                                ? `${task.name} already running`
                                : result.reason === "conflicting_task_running"
                                  ? "Another library task is already running"
                                  : `${task.name} skipped`
                            );
                          } else {
                            notify(`${task.name} queued`);
                          }
                        })
                        .catch((error) => notify(error instanceof Error ? error.message : "Could not start task"))
                        .finally(() => {
                          void tasks.refetch();
                          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
                        });
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button className="shrink-0" variant="outline" size="icon" onClick={() => tasks.refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
        <SettingsCard title="Quality Profiles" tab="quality" activeTab={settingsTab} fullWidth flush>
          <Profiles embedded />
        </SettingsCard>
        <SettingsCard title="Operational Logs" tab="logs" activeTab={settingsTab} fullWidth flush>
          <Logs embedded />
        </SettingsCard>
        <SettingsCard title="User / Group Management" tab="users" activeTab={settingsTab} fullWidth>
          {user?.isAdmin ? (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-5">
                <Input value={newUserDraft.username} onChange={(event) => setNewUserDraft({ ...newUserDraft, username: event.target.value })} placeholder="username" />
                <Input value={newUserDraft.displayName} onChange={(event) => setNewUserDraft({ ...newUserDraft, displayName: event.target.value })} placeholder="display name" />
                <Input type="password" value={newUserDraft.password} onChange={(event) => setNewUserDraft({ ...newUserDraft, password: event.target.value })} placeholder="temporary password" />
                <Select value={newUserDraft.isAdmin ? "admin" : "standard"} onChange={(event) => setNewUserDraft({ ...newUserDraft, isAdmin: event.target.value === "admin" })}>
                  <option value="standard">Standard</option>
                  <option value="admin">Admin</option>
                </Select>
                <Button onClick={() => createAdminUser.mutate()} disabled={!newUserDraft.username.trim() || !newUserDraft.password.trim()}>Create user</Button>
              </div>
              <div className="space-y-2">
                {(adminUsers.data?.users ?? []).map((managedUser) => (
                  <div key={managedUser.id} className="rounded-xl border bg-background/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{managedUser.displayName} <span className="text-muted-foreground">({managedUser.username})</span></p>
                        <p className="text-xs text-muted-foreground">{managedUser.group} · created {formatTaskDate(managedUser.createdAt, "-")}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => updateAdminUser.mutate({ id: managedUser.id, payload: { isAdmin: !managedUser.isAdmin } })}>
                          {managedUser.isAdmin ? "Make standard" : "Make admin"}
                        </Button>
                        <Button variant="outline" onClick={() => updateAdminUser.mutate({ id: managedUser.id, payload: { mustChangePassword: !managedUser.mustChangePassword } })}>
                          {managedUser.mustChangePassword ? "Clear password flag" : "Force password change"}
                        </Button>
                        <Input
                          className="w-44"
                          type="password"
                          value={resetPasswordDraft[managedUser.id] ?? ""}
                          onChange={(event) => setResetPasswordDraft((current) => ({ ...current, [managedUser.id]: event.target.value }))}
                          placeholder="new password"
                        />
                        <Button
                          variant="outline"
                          onClick={() => resetAdminPassword.mutate({ id: managedUser.id, password: resetPasswordDraft[managedUser.id] ?? "" })}
                          disabled={!(resetPasswordDraft[managedUser.id] ?? "").trim()}
                        >
                          Reset password
                        </Button>
                        {managedUser.id !== user.id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete user"
                            onClick={() => {
                              if (!window.confirm(`Delete ${managedUser.username}?`)) return;
                              deleteAdminUser.mutate(managedUser.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Admin access required.</p>
          )}
        </SettingsCard>
        <SettingsCard title="FUSE / SAB API" tab="system" activeTab={settingsTab} fullWidth>
          <p className="text-sm text-muted-foreground">Drakkar exposes releases through WebDAV + rclone VFS at <span className="font-mono text-foreground">/mnt/drakkar/vfs</span>, while Plex/library files live at <span className="font-mono text-foreground">/mnt/drakkar/media</span>. Direct media is mounted for streaming; archives stay on the mounted VFS path instead of being unpacked into a downloads folder.</p>
        </SettingsCard>
        <SettingsCard title="Danger Zone" tab="system" activeTab={settingsTab} fullWidth>
          <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">Clears the full blacklist and removes all downloaded, completed, imported, and library-linked media so the environment starts clean again.</p>
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={resetEnvironment.isPending}
              onClick={() => {
                if (!window.confirm("Clear blacklist and remove all downloaded/imported/library media?")) return;
                if (!window.confirm("This is destructive. Continue?")) return;
                resetEnvironment.mutate();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />{resetEnvironment.isPending ? "Clearing..." : "Clear Environment"}
            </Button>
          </div>
        </SettingsCard>
      </section>
    </div>
  );
}

function SettingsCard({
  title,
  children,
  tab,
  activeTab,
  fullWidth = false,
  flush = false
}: {
  title: string;
  children: ReactNode;
  tab: SettingsTab;
  activeTab: SettingsTab;
  fullWidth?: boolean;
  flush?: boolean;
}) {
  if (tab !== activeTab) return null;
  return (
    <Card className={`space-y-3 ${fullWidth ? "lg:col-span-2" : ""} ${flush ? "p-0" : "p-4"}`}>
      <div className={flush ? "px-4 pt-4" : ""}>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className={flush ? "px-4 pb-4" : ""}>{children}</div>
    </Card>
  );
}

function LabeledInput({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}

function LabeledSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="text-muted-foreground">{label}</span><Select className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select></label>;
}

function CheckboxLabel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatInterval(value?: number | null) {
  if (!value) return "Manual / startup";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr`;
}

function formatTaskDate(value: string | null, fallback: string) {
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

function resolveDefaultProfileValue(profileNames: string[], currentValue: string | undefined, preferredValue: string) {
  if (currentValue === "Anime" && profileNames.includes(preferredValue)) return preferredValue;
  if (currentValue && profileNames.includes(currentValue)) return currentValue;
  if (profileNames.includes(preferredValue)) return preferredValue;
  return profileNames[0] ?? currentValue ?? "";
}

function taskStatusClassName(status: string) {
  if (status === "running") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  if (status === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-border/80 bg-muted text-muted-foreground";
}

function topCountLabel(values?: Record<string, number>) {
  if (!values) return "0";
  const [top] = Object.entries(values).sort((a, b) => b[1] - a[1]);
  return top ? `${top[0]} (${top[1]})` : "0";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function cleanRequestProviderUpdate(provider: RequestProviderInput): Partial<RequestProviderInput> {
  return {
    ...cleanRequestProvider(provider),
    apiKey: provider.apiKey.trim() || undefined
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
