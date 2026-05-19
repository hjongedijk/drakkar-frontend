import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-red-200">{message}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">{message}</div>;
}
