import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Server, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useToast } from "../components/ToastProvider";

const steps = [
  ["nzbhydra", "NZBHydra2", "Indexer URL and API key"],
  ["usenet", "Usenet", "Provider host, credentials, and connections"],
  ["requestProvider", "Seerr", "Request Sync"],
  ["metadata", "Metadata", "TMDB or TVDB API key"],
  ["plex", "Plex", "Server URL, OAuth token, and library path"]
] as const;

export function SetupWizard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [username, setUsername] = useState("admin");
  const [displayName, setDisplayName] = useState("Admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const status = useQuery({ queryKey: ["setup-status"], queryFn: api.setupStatus });
  const complete = useMutation({
    mutationFn: () => {
      if (status.data?.adminRequired) {
        if (password !== confirmPassword) throw new Error("passwords do not match");
        return api.completeSetup({ admin: { username, displayName, password } });
      }
      return api.completeSetup();
    },
    onSuccess: () => {
      notify("Setup complete. Log in with admin user.");
      queryClient.invalidateQueries({ queryKey: ["setup-status"] });
      navigate("/login", { replace: true });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not complete setup")
  });

  if (status.isLoading) return <LoadingState />;
  if (status.isError || !status.data) return <ErrorState message="Could not load setup status." />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Setup Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configure the services Drakkar needs before importing and streaming media.</p>
      </div>
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <div className="rounded-xl border bg-background/40 p-3">
          <Sparkles className="mb-2 h-5 w-5 text-primary" />
          <p className="font-semibold">Guided setup</p>
          <p className="mt-1 text-sm text-muted-foreground">Create main admin first. Add integrations after login or seed them from settings.json.</p>
        </div>
        <div className="rounded-xl border bg-background/40 p-3 md:col-span-2">
          <Server className="mb-2 h-5 w-5 text-primary" />
          <p className="font-semibold">Config file bootstrap</p>
          <p className="mt-1 text-sm text-muted-foreground">Fresh installs can also seed settings from <code>/data/config/settings.json</code>. Empty defaults are safe and will not erase database values.</p>
        </div>
      </Card>
      {status.data.adminRequired ? (
        <Card className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Main admin user</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Username</span>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Display name</span>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Password</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Confirm password</span>
              <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </label>
          </div>
        </Card>
      ) : null}
      <Card className="space-y-3 p-4">
        {steps.map(([key, title, description]) => {
          const ok = status.data.checks[key];
          return (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex min-w-0 items-center gap-3">
                {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={ok ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>{ok ? "ready" : "needs config"}</span>
              </div>
            </div>
          );
        })}
      </Card>
      <div className="flex flex-wrap gap-2">
        {!status.data.adminRequired ? <Button asChild><Link to="/login">Go to login</Link></Button> : null}
        <Button variant="outline" onClick={() => complete.mutate()} disabled={complete.isPending || status.data.completed}>
          {status.data.completed ? "Setup complete" : status.data.adminRequired ? "Create admin and finish setup" : "Finish setup"}
        </Button>
      </div>
    </div>
  );
}
