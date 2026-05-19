import { Component, type PropsWithChildren, type ReactNode } from "react";

type State = { error?: Error };

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <section className="max-w-lg rounded-lg border bg-card p-6 text-card-foreground">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
