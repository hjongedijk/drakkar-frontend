import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

export function Logs() {
  const [level, setLevel] = useState("all");
  const [term, setTerm] = useState("");
  const logs = useQuery({ queryKey: ["logs"], queryFn: api.logs, refetchInterval: 5000 });

  const rows = useMemo(() => {
    return (logs.data ?? [])
      .filter((row) => level === "all" || row.level === level)
      .filter((row) => !term || `${row.service} ${row.message} ${row.id}`.toLowerCase().includes(term.toLowerCase()))
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [logs.data, level, term]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational events assembled from backend job state.</p>
        </div>
        <Button className="w-full sm:w-auto" variant="outline" asChild>
          <a href={api.logsDownloadUrl()} download>
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-[160px_1fr]">
        <Select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="all">All levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search logs, download IDs, request IDs" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3">Time</th><th className="p-3">Level</th><th className="p-3">Service</th><th className="p-3">Message</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.id}-${index}`} className="border-b last:border-0">
                <td className="p-3 text-muted-foreground">{new Date(row.time).toLocaleString()}</td>
                <td className="p-3">{row.level}</td>
                <td className="p-3">{row.service}</td>
                <td className="p-3">{row.message}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-6 text-muted-foreground" colSpan={4}>No log events match the filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
