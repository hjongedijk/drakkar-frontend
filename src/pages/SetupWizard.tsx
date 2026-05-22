import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ErrorState, LoadingState } from "../components/PageState";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useToast } from "../components/ToastProvider";

const steps = [
  ["nzbhydra", "NZBHydra2", "Indexer URL and API key"],
  ["usenet", "Usenet", "Provider host, credentials, and connections"],
  ["requestProvider", "Seerr", "Request sync provider"],
  ["metadata", "Metadata", "TMDB or TVDB API key"],
  ["plex", "Plex", "Server URL, token, and library path"]
] as const;

export function SetupWizard() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const status = useQuery({ queryKey: ["setup-status"], queryFn: api.setupStatus });
  const complete = useMutation({
    mutationFn: () => api.completeSetup(),
    onSuccess: () => {
      notify("Setup marked complete");
      queryClient.invalidateQueries({ queryKey: ["setup-status"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "Could not complete setup")
  });

  if (status.isLoading) return <LoadingState />;
  if (status.isError || !status.data) return <ErrorState message="Could not load setup status." />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Setup Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Minimum checks before exposing Drakkar publicly.</p>
      </div>
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
              <span className={ok ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>{ok ? "ready" : "needs config"}</span>
            </div>
          );
        })}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/settings"><Settings className="mr-2 h-4 w-4" />Open settings</Link></Button>
        <Button variant="outline" onClick={() => complete.mutate()} disabled={complete.isPending || status.data.completed}>
          {status.data.completed ? "Setup complete" : "Mark complete"}
        </Button>
      </div>
    </div>
  );
}
