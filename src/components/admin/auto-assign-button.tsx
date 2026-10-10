"use client";

import { Loader2Icon, ShuffleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { type AssignMode, autoAssignSessions } from "@/lib/admin-client";

const RUNNERS = { sesi: autoAssignSessions } as const;

/** Tombol "bagi otomatis" dengan pilihan cakupan dan konfirmasi untuk "semua". */
export function AutoAssignButton({
  label,
  kind,
  unassignedCount,
}: {
  label: string;
  /** Jenis pembagian; menentukan aksi yang dijalankan. */
  kind: keyof typeof RUNNERS;
  unassignedCount: number;
}) {
  const run = RUNNERS[kind];
  const router = useRouter();
  const [mode, setMode] = useState<AssignMode>(unassignedCount > 0 ? "unassigned" : "all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function go() {
    if (mode === "all" && !confirm("Bagi ulang SEMUA peserta? Pembagian yang ada akan diganti.")) return;
    setBusy(true);
    const result = await run(mode);
    setBusy(false);
    setMessage(result.ok ? `Selesai${result.simulated ? " (mode simulasi)" : ""}.` : result.error);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as AssignMode)}
        aria-label="Cakupan pembagian otomatis"
        className="h-9 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="unassigned">Hanya yang belum ({unassignedCount})</option>
        <option value="all">Semua peserta (bagi ulang)</option>
      </select>
      <Button variant="outline" size="sm" onClick={go} disabled={busy || (mode === "unassigned" && unassignedCount === 0)}>
        {busy ? <Loader2Icon className="animate-spin" /> : <ShuffleIcon />} {label}
      </Button>
      {message && <span aria-live="polite" className="text-muted-foreground">{message}</span>}
    </div>
  );
}
