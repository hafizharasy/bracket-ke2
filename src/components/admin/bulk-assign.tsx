"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { assignParticipants } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

export type AssignRow = { id: string; name: string; groupId: string | null };
export type AssignGroup = { id: string; name: string };

const SHOW = 200;

/**
 * Pilih banyak peserta (cari + filter kelompok + centang) lalu pindahkan
 * ke satu kelompok tujuan. Dipakai untuk sesi maupun ruangan.
 */
export function BulkAssign({
  rows,
  groups,
  field,
  noun,
}: {
  rows: AssignRow[];
  groups: AssignGroup[];
  /** Kolom yang diubah. */
  field: "sessionId" | "roomId";
  /** "sesi" / "ruangan" untuk teks. */
  noun: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<string>("");
  const [target, setTarget] = useState<string>(groups[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (from === "" || (from === "none" ? r.groupId === null : r.groupId === from)) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle)),
    );
  }, [rows, q, from]);
  const shown = visible.slice(0, SHOW);
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (allShownSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  async function move() {
    if (selected.size === 0) return;
    setBusy(true);
    const result = await assignParticipants([...selected], { [field]: target || null });
    setBusy(false);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    setMessage({
      ok: true,
      text: `${selected.size} peserta dipindahkan ke ${groupName.get(target) ?? `tanpa ${noun}`}${result.simulated ? " (mode simulasi)" : ""}.`,
    });
    setSelected(new Set());
    router.refresh();
  }

  const control = "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Cari peserta</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau ID…" className={cn(control, "w-full pl-9")} />
        </label>
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label={`Filter ${noun} asal`} className={control}>
          <option value="">Semua {noun}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
          <option value="none">Belum ada {noun}</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
        <span className="font-medium">{selected.size} dipilih</span>
        <span className="text-muted-foreground">→ pindahkan ke</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={`${noun} tujuan`} className={control}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
          <option value="">Kosongkan {noun}</option>
        </select>
        <Button size="sm" onClick={move} disabled={busy || selected.size === 0}>
          {busy && <Loader2Icon className="animate-spin" />} Pindahkan
        </Button>
        {selected.size > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Batal pilih
          </Button>
        )}
      </div>
      {message && (
        <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
          {message.text}
        </p>
      )}

      <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Pilih semua yang tampil" />
              </th>
              <th className="px-3 py-2 font-medium">Peserta</th>
              <th className="px-3 py-2 font-medium capitalize">{noun} sekarang</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={cn("border-t", selected.has(r.id) && "bg-primary/5")}>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Pilih ${r.name}`} />
                </td>
                <td className="px-3 py-1.5">
                  {r.name} <span className="font-mono text-xs text-muted-foreground">{r.id.toUpperCase()}</span>
                </td>
                <td className="px-3 py-1.5">
                  {r.groupId ? groupName.get(r.groupId) : <span className="text-xs text-amber-700 dark:text-amber-400">Belum</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {visible.length} peserta cocok{visible.length > SHOW ? `, ${SHOW} pertama ditampilkan (gunakan pencarian/filter)` : ""}.
        &ldquo;Pilih semua&rdquo; memilih seluruh {visible.length} peserta yang cocok.
      </p>
    </div>
  );
}
