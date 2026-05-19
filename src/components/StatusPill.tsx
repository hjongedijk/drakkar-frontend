import { cn } from "../lib/utils";

type Props = {
  value: string | number | null | { usedBytes?: number; totalBytes?: number; freeBytes?: number };
};

export function StatusPill({ value }: Props) {
  const text = value && typeof value === "object" ? formatStorage(value) : value === null ? "unknown" : String(value);
  const ok = text === "ok" || Number(text) > 0 || /\b(?:KB|MB|GB|TB)\b/.test(text);
  const idle = text === "not_configured" || text === "0" || text === "unknown";

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium",
        ok && "border-primary/30 bg-primary/10 text-primary",
        idle && "border-border bg-muted text-muted-foreground",
        !ok && !idle && "border-destructive/30 bg-destructive/10 text-red-300"
      )}
    >
      {text.replaceAll("_", " ")}
    </span>
  );
}

function formatStorage(storage: { usedBytes?: number; totalBytes?: number }) {
  if (!Number.isFinite(storage.usedBytes) || !Number.isFinite(storage.totalBytes)) return "unknown";
  return `${formatBytes(storage.usedBytes ?? 0)} / ${formatBytes(storage.totalBytes ?? 0)}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
