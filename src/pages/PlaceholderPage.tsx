type Props = {
  title: string;
};

export function PlaceholderPage({ title }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        This workspace is ready for the next implementation layer.
      </section>
    </div>
  );
}
