import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ExternalLink, Server, UserPlus } from "lucide-react";
import { useMachine } from "@xstate/react";
import { ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useToast } from "../components/ToastProvider";
import { setupWizardMachine } from "../machines/setupWizardMachine";

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
  const [state, send] = useMachine(setupWizardMachine);
  const { form, plexPin, status, message, error, saveSucceededAt } = state.context;
  const lastOpenedPlexPinId = useRef<number | null>(null);
  const lastSavedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!plexPin || lastOpenedPlexPinId.current === plexPin.pinId) return;
    lastOpenedPlexPinId.current = plexPin.pinId;
    window.open(plexPin.authUrl, "_blank", "noopener,noreferrer");
  }, [plexPin]);

  useEffect(() => {
    if (!saveSucceededAt || lastSavedAt.current === saveSucceededAt) return;
    lastSavedAt.current = saveSucceededAt;
    notify("Setup saved. Log in with admin user.");
    void queryClient.invalidateQueries({ queryKey: ["setup-status"] });
    navigate("/login", { replace: true });
  }, [navigate, notify, queryClient, saveSucceededAt]);

  useEffect(() => {
    if (!message && !error) return;
    notify(error ?? message ?? "", error ? "error" : "success");
    send({ type: "dismissMessage" });
  }, [error, message, notify, send]);

  if (state.matches("loading")) return <LoadingState />;
  if (state.matches("loadFailed") || !status) return <ErrorState message={error ?? "Could not load setup status."} />;

  const saving = state.matches({ ready: { submit: "saving" } });
  const plexBusy = state.matches({ ready: { plex: "starting" } }) || state.matches({ ready: { plex: "polling" } }) || state.matches({ ready: { plex: "waiting" } }) || state.matches({ ready: { plex: "checking" } });

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

      {status.adminRequired ? (
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">Main admin user</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Username"><Input value={form.username} onChange={(event) => send({ type: "updateField", field: "username", value: event.target.value })} autoComplete="username" /></Field>
            <Field label="Display name"><Input value={form.displayName} onChange={(event) => send({ type: "updateField", field: "displayName", value: event.target.value })} /></Field>
            <Field label="Password"><Input type="password" value={form.password} onChange={(event) => send({ type: "updateField", field: "password", value: event.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm password"><Input type="password" value={form.confirmPassword} onChange={(event) => send({ type: "updateField", field: "confirmPassword", value: event.target.value })} autoComplete="new-password" /></Field>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">NZBHydra2</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="URL"><Input value={form.nzbhydraUrl} onChange={(event) => send({ type: "updateField", field: "nzbhydraUrl", value: event.target.value })} placeholder="http://nzbhydra2:5076" /></Field>
          <Field label="API key"><Input value={form.nzbhydraApiKey} onChange={(event) => send({ type: "updateField", field: "nzbhydraApiKey", value: event.target.value })} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Usenet provider</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={form.usenetName} onChange={(event) => send({ type: "updateField", field: "usenetName", value: event.target.value })} /></Field>
          <Field label="Host"><Input value={form.usenetHost} onChange={(event) => send({ type: "updateField", field: "usenetHost", value: event.target.value })} placeholder="news.example.com" /></Field>
          <Field label="Port"><Input value={form.usenetPort} onChange={(event) => send({ type: "updateField", field: "usenetPort", value: event.target.value })} inputMode="numeric" /></Field>
          <Field label="Connections"><Input value={form.usenetConnections} onChange={(event) => send({ type: "updateField", field: "usenetConnections", value: event.target.value })} inputMode="numeric" /></Field>
          <Field label="Username"><Input value={form.usenetUsername} onChange={(event) => send({ type: "updateField", field: "usenetUsername", value: event.target.value })} /></Field>
          <Field label="Password"><Input type="password" value={form.usenetPassword} onChange={(event) => send({ type: "updateField", field: "usenetPassword", value: event.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={form.usenetSsl} onChange={(event) => send({ type: "updateField", field: "usenetSsl", value: event.target.checked })} />
          SSL enabled
        </label>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Seerr</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={form.requestProviderName} onChange={(event) => send({ type: "updateField", field: "requestProviderName", value: event.target.value })} /></Field>
          <Field label="Base URL"><Input value={form.requestProviderUrl} onChange={(event) => send({ type: "updateField", field: "requestProviderUrl", value: event.target.value })} placeholder="http://seerr:5055" /></Field>
          <Field label="API key"><Input value={form.requestProviderApiKey} onChange={(event) => send({ type: "updateField", field: "requestProviderApiKey", value: event.target.value })} /></Field>
          <Field label="Sync minutes"><Input value={form.requestProviderInterval} onChange={(event) => send({ type: "updateField", field: "requestProviderInterval", value: event.target.value })} inputMode="numeric" /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Metadata</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="TMDB API key"><Input value={form.tmdbApiKey} onChange={(event) => send({ type: "updateField", field: "tmdbApiKey", value: event.target.value })} /></Field>
          <Field label="TVDB API key"><Input value={form.tvdbApiKey} onChange={(event) => send({ type: "updateField", field: "tvdbApiKey", value: event.target.value })} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Plex</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Server URL"><Input value={form.plexServerUrl} onChange={(event) => send({ type: "updateField", field: "plexServerUrl", value: event.target.value })} placeholder="http://plex:32400" /></Field>
          <Field label="Token"><Input value={form.plexToken} onChange={(event) => send({ type: "updateField", field: "plexToken", value: event.target.value })} /></Field>
          <Field label="Library path"><Input value={form.plexLibraryPath} onChange={(event) => send({ type: "updateField", field: "plexLibraryPath", value: event.target.value })} /></Field>
          <Field label="Section ID"><Input value={form.plexSectionId} onChange={(event) => send({ type: "updateField", field: "plexSectionId", value: event.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => send({ type: "startPlexOauth" })} disabled={plexBusy}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Get token with Plex
          </Button>
          {plexPin ? (
            <Button type="button" variant="outline" asChild>
              <a href={plexPin.authUrl} target="_blank" rel="noreferrer">Open PIN {plexPin.code}</a>
            </Button>
          ) : null}
        </div>
        {plexPin ? <p className="text-xs text-muted-foreground">Waiting for Plex approval. Drakkar polls automatically.</p> : null}
      </Card>

      <Card className="space-y-3 p-4">
        {steps.map(([key, title]) => {
          const ok = status.checks[key];
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
        {!status.adminRequired ? <Button asChild><Link to="/login">Go to login</Link></Button> : null}
        <Button variant="outline" onClick={() => send({ type: "save" })} disabled={saving || status.completed}>
          {status.completed ? "Setup complete" : saving ? "Saving..." : "Save setup"}
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
