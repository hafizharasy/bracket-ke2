"use client";

import { Loader2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveSemifinalPairsAction } from "@/app/admin/peserta/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RoomChampion = { matchId: string; label: string; winner: string | null };

const select = "h-9 w-full rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Atur dua juara ruangan-sesi untuk tiap laga semifinal (best of 3).
 * `initial[k]` = pasangan saat ini untuk semifinal ke-(k+1).
 */
export function SemifinalPairsEditor({
  champions,
  initial,
  locked,
}: {
  champions: RoomChampion[];
  initial: [string, string][];
  locked: boolean;
}) {
  const router = useRouter();
  const [pairs, setPairs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const byId = new Map(champions.map((c) => [c.matchId, c]));

  const used = pairs.flat();
  const duplicates = new Set(used.filter((id, i) => used.indexOf(id) !== i));
  const dirty = JSON.stringify(pairs) !== JSON.stringify(initial);

  function change(k: number, side: 0 | 1, matchId: string) {
    setMessage(null);
    setPairs((prev) => {
      const next = prev.map((p) => [...p] as [string, string]);
      // Tukar otomatis: juara yang dipilih pindah dari pasangan lamanya.
      for (const p of next) {
        for (const s of [0, 1] as const) if (p[s] === matchId) p[s] = prev[k][side];
      }
      next[k][side] = matchId;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const result = await saveSemifinalPairsAction(pairs);
    setBusy(false);
    setMessage(
      result.ok
        ? { ok: true, text: result.simulated ? "Mode simulasi: pasangan tidak disimpan." : "Pasangan semifinal tersimpan." }
        : { ok: false, text: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {locked && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-4" /> Semifinal sudah dimulai, pasangan dikunci.
        </p>
      )}
      <ol className="grid gap-2 sm:grid-cols-2">
        {pairs.map((pair, k) => (
          <li key={k} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
            <span className="text-sm font-semibold">Semifinal #{k + 1}</span>
            {([0, 1] as const).map((side) => {
              const current = byId.get(pair[side]);
              return (
                <label key={side} className="flex flex-col gap-0.5 text-xs">
                  <select
                    aria-label={`Semifinal ${k + 1} peserta ${side === 0 ? "A" : "B"}`}
                    value={pair[side]}
                    disabled={locked || busy}
                    onChange={(e) => change(k, side, e.target.value)}
                    className={cn(select, duplicates.has(pair[side]) && "border-destructive")}
                  >
                    {champions.map((c) => (
                      <option key={c.matchId} value={c.matchId}>{c.label}</option>
                    ))}
                  </select>
                  <span className="pl-1 text-muted-foreground">{current?.winner ?? "Juara belum ditentukan"}</span>
                </label>
              );
            })}
          </li>
        ))}
      </ol>
      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy || !dirty || duplicates.size > 0}>
            {busy && <Loader2Icon className="animate-spin" />}
            Simpan pasangan semifinal
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => { setPairs(initial); setMessage(null); }} disabled={busy}>
              Batal
            </Button>
          )}
          {message && (
            <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
