import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Server, UserPlus } from "lucide-react";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useToast } from "../components/ToastProvider";

const steps = [
  ["nzbhydra", "NZBHydra2"],
  ["usenet", "Usenet"],
  ["requestProvider", "Seerr"],
  ["metadata", "Metadata"],
  ["plex", "Plex"]
] as const;

export function SetupWizard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [username, setUsername] = useState("admin");
  const [displayName, setDisplayName] = useState("Admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nzbhydraUrl, setNzbhydraUrl] = useState("");
  const [nzbhydraApiKey, setNzbhydraApiKey] = useState("");
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tvdbApiKey, setTvdbApiKey] = useState("");
  const [plexServerUrl, setPlexServerUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [plexLibraryPath, setPlexLibraryPath] = useState("/mnt/media");
  const [plexSectionId, setPlexSectionId] = useState("");
  const [usenetName, setUsenetName] = useState("Primary");
  const [usenetHost, setUsenetHost] = useState("");
  const [usenetPort, setUsenetPort] = useState("563");
  const [usenetSsl, setUsenetSsl] = useState(true);
  const [usenetUsername, setUsenetUsername] = useState("");
  const [usenetPassword, setUsenetPassword] = useState("");
  const [usenetConnections, setUsenetConnections] = useState("24");
  const [requestProviderName, setRequestProviderName] = useState("Seerr");
  const [requestProviderUrl, setRequestProviderUrl] = useState("");
  const [requestProviderApiKey, setRequestProviderApiKey] = useState("");
  const [requestProviderInterval, setRequestProviderInterval] = useState("15");
  const status = useQuery({ queryKey: ["setup-status"], queryFn: api.setupStatus });

  useEffect(() => {
    if (!status.data) return;
    setNzbhydraUrl((current) => current || status.data!.prefill.nzbhydraUrl);
    setNzbhydraApiKey((current) => current || status.data!.prefill.nzbhydraApiKey);
    setTmdbApiKey((current) => current || status.data!.prefill.tmdbApiKey);
    setTvdbApiKey((current) => current || status.data!.prefill.tvdbApiKey);
    setPlexServerUrl((current) => current || status.data!.prefill.plexServerUrl);
    setPlexToken((current) => current || status.data!.prefill.plexToken);
    setPlexLibraryPath((current) => current || status.data!.prefill.plexLibraryPath || "/mnt/media");
    setPlexSectionId((current) => current || status.data!.prefill.plexSectionId);
    setUsenetName((current) => current || status.data!.prefill.usenet?.name || "Primary");
    setUsenetHost((current) => current || status.data!.prefill.usenet?.host || "");
    setUsenetPort((current) => current || String(status.data!.prefill.usenet?.port ?? 563));
    setUsenetSsl(status.data.prefill.usenet?.ssl ?? true);
    setUsenetUsername((current) => current || status.data!.prefill.usenet?.username || "");
    setUsenetPassword((current) => current || status.data!.prefill.usenet?.password || "");
    setUsenetConnections((current) => current || String(status.data!.prefill.usenet?.connections ?? 24));
    setRequestProviderName((current) => current || status.data!.prefill.requestProvider?.name || "Seerr");
    setRequestProviderUrl((current) => current || status.data!.prefill.requestProvider?.baseUrl || "");
    setRequestProviderApiKey((current) => current || status.data!.prefill.requestProvider?.apiKey || "");
    setRequestProviderInterval((current) => current || String(status.data!.prefill.requestProvider?.syncIntervalMinutes ?? 15));
  }, [status.data]);

  const complete = useMutation({
    mutationFn: () => {
      if (status.data?.adminRequired && password !== confirmPassword) throw new Error("passwords do not match");
      return api.completeSetup({
        ...(status.data?.adminRequired ? { admin: { username, displayName, password } } : {}),
        settings: {
          nzbhydraUrl,
          nzbhydraApiKey,
          tmdbApiKey,
          tvdbApiKey,
          plexServerUrl,
          plexToken,
          plexLibraryPath,
          plexSectionId
        },
        ...(usenetHost ? {
          usenet: {
            name: usenetName,
            host: usenetHost,
            port: Number(usenetPort || 563),
            ssl: usenetSsl,
            username: usenetUsername,
            password: usenetPassword,
            connections: Number(usenetConnections || 24),
            priority: 0,
            enabled: true,
            isBackup: false
          }
        } : {}),
        ...(requestProviderUrl && requestProviderApiKey ? {
          requestProvider: {
            name: requestProviderName,
            baseUrl: requestProviderUrl,
            apiKey: requestProviderApiKey,
            enabled: true,
            syncIntervalMinutes: Number(requestProviderInterval || 15)
          }
        } : {})
      });
    },
    onSuccess: () => {
      notify("Setup saved. Log in with admin user.");
      queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      navigate("/login", { replace: true });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not complete setup")
  });

  if (status.isLoading) return <LoadingState />;
  if (status.isError || !status.data) return <ErrorState message="Could not load setup status." />;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Setup Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill the services now. Empty sections can stay empty and be configured later.</p>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <div className="rounded-xl border bg-background/40 p-3">
          <UserPlus className="mb-2 h-5 w-5 text-primary" />
          <p className="font-semibold">Admin</p>
          <p className="mt-1 text-sm text-muted-foreground">First login account.</p>
        </div>
        <div className="rounded-xl border bg-background/40 p-3">
          <Server className="mb-2 h-5 w-5 text-primary" />
          <p className="font-semibold">settings.json aware</p>
          <p className="mt-1 text-sm text-muted-foreground">Existing values from <code>/data/config/settings.json</code> or database are prefilled here.</p>
        </div>
        <div className="rounded-xl border bg-background/40 p-3">
          <CheckCircle2 className="mb-2 h-5 w-5 text-primary" />
          <p className="font-semibold">Safe to skip</p>
          <p className="mt-1 text-sm text-muted-foreground">Only filled sections are saved.</p>
        </div>
      </Card>

      {status.data.adminRequired ? (
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">Main admin user</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Username"><Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></Field>
            <Field label="Display name"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>
            <Field label="Confirm password"><Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></Field>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">NZBHydra2</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="URL"><Input value={nzbhydraUrl} onChange={(event) => setNzbhydraUrl(event.target.value)} placeholder="http://nzbhydra2:5076" /></Field>
          <Field label="API key"><Input value={nzbhydraApiKey} onChange={(event) => setNzbhydraApiKey(event.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Usenet provider</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={usenetName} onChange={(event) => setUsenetName(event.target.value)} /></Field>
          <Field label="Host"><Input value={usenetHost} onChange={(event) => setUsenetHost(event.target.value)} placeholder="news.example.com" /></Field>
          <Field label="Port"><Input value={usenetPort} onChange={(event) => setUsenetPort(event.target.value)} inputMode="numeric" /></Field>
          <Field label="Connections"><Input value={usenetConnections} onChange={(event) => setUsenetConnections(event.target.value)} inputMode="numeric" /></Field>
          <Field label="Username"><Input value={usenetUsername} onChange={(event) => setUsenetUsername(event.target.value)} /></Field>
          <Field label="Password"><Input type="password" value={usenetPassword} onChange={(event) => setUsenetPassword(event.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={usenetSsl} onChange={(event) => setUsenetSsl(event.target.checked)} />
          SSL enabled
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Seerr</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={requestProviderName} onChange={(event) => setRequestProviderName(event.target.value)} /></Field>
          <Field label="Base URL"><Input value={requestProviderUrl} onChange={(event) => setRequestProviderUrl(event.target.value)} placeholder="http://seerr:5055" /></Field>
          <Field label="API key"><Input value={requestProviderApiKey} onChange={(event) => setRequestProviderApiKey(event.target.value)} /></Field>
          <Field label="Sync minutes"><Input value={requestProviderInterval} onChange={(event) => setRequestProviderInterval(event.target.value)} inputMode="numeric" /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Metadata</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="TMDB API key"><Input value={tmdbApiKey} onChange={(event) => setTmdbApiKey(event.target.value)} /></Field>
          <Field label="TVDB API key"><Input value={tvdbApiKey} onChange={(event) => setTvdbApiKey(event.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Plex</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Server URL"><Input value={plexServerUrl} onChange={(event) => setPlexServerUrl(event.target.value)} placeholder="http://plex:32400" /></Field>
          <Field label="Token"><Input value={plexToken} onChange={(event) => setPlexToken(event.target.value)} /></Field>
          <Field label="Library path"><Input value={plexLibraryPath} onChange={(event) => setPlexLibraryPath(event.target.value)} /></Field>
          <Field label="Section ID"><Input value={plexSectionId} onChange={(event) => setPlexSectionId(event.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        {steps.map(([key, title]) => {
          const ok = status.data.checks[key];
          return (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex items-center gap-3">
                {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <span className="font-semibold">{title}</span>
              </div>
              <span className={ok ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>{ok ? "ready" : "needs config"}</span>
            </div>
          );
        })}
      </Card>

      <div className="flex flex-wrap gap-2">
        {!status.data.adminRequired ? <Button asChild><Link to="/login">Go to login</Link></Button> : null}
        <Button variant="outline" onClick={() => complete.mutate()} disabled={complete.isPending || status.data.completed}>
          {status.data.completed ? "Setup complete" : "Save setup"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
