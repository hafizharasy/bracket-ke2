"use client";

import { EyeOffIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveRefereesAction } from "@/app/admin/laga/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RefereeRow = { matchId: string; label: string; detail?: string };

const input = "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Input nama pengawas per laga (privat — hanya terlihat admin). Satu baris
 * untuk halaman detail laga, banyak baris untuk isi sekaligus per ruangan.
 */
export function RefereeEditor({ rows, initial }: { rows: RefereeRow[]; initial: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initial }));
  const [fill, setFill] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = rows.filter((r) => (values[r.matchId] ?? "").trim() !== (initial[r.matchId] ?? ""));
  const single = rows.length === 1;

  async function save() {
    setBusy(true);
    const result = await saveRefereesAction(changed.map((r) => ({ matchId: r.matchId, refereeName: (values[r.matchId] ?? "").trim() })));
    setBusy(false);
    setMessage(
      !result.ok
        ? { ok: false, text: result.error }
        : result.simulated
          ? { ok: true, text: "Mode simulasi: nama pengawas tidak disimpan." }
          : { ok: true, text: `Tersimpan (${result.saved} diisi${result.cleared ? `, ${result.cleared} dikosongkan` : ""}).` },
    );
    if (result.ok) router.refresh();
  }

  function fillEmpty() {
    const name = fill.trim();
    if (!name) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!(next[r.matchId] ?? "").trim()) next[r.matchId] = name;
      return next;
    });
    setMessage(null);
  }

  return (
    <section aria-label="Nama pengawas laga" className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2">
        <EyeOffIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Nama pengawas{single ? "" : ` per laga (${rows.length} laga)`}</h2>
          <p className="text-xs text-muted-foreground">Rahasia: hanya admin yang bisa melihat. Tidak tampil di bagan publik maupun halaman pengawas ruangan.</p>
        </div>
      </div>

      {!single && (
        <div className="flex flex-wrap items-center gap-2">
          <input value={fill} onChange={(e) => setFill(e.target.value)} maxLength={100} placeholder="Isi semua laga yang kosong dengan…" className={cn(input, "max-w-xs")} />
          <Button size="sm" variant="outline" onClick={fillEmpty} disabled={!fill.trim()}>
            Isi yang kosong
          </Button>
        </div>
      )}

      <ul className={cn("flex flex-col", !single && "max-h-[32rem] divide-y overflow-y-auto rounded-lg border")}>
        {rows.map((r) => (
          <li key={r.matchId} className={cn("flex flex-wrap items-center gap-2", !single && "px-2 py-1.5")}>
            {!single && (
              <label htmlFor={`ref-${r.matchId}`} className="w-full min-w-0 text-xs sm:w-72">
                <span className="font-medium">{r.label}</span>
                {r.detail && <span className="block truncate text-muted-foreground">{r.detail}</span>}
              </label>
            )}
            <input
              id={`ref-${r.matchId}`}
              aria-label={`Nama pengawas ${r.label}`}
              value={values[r.matchId] ?? ""}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [r.matchId]: e.target.value }));
                setMessage(null);
              }}
              maxLength={100}
              placeholder="Nama pengawas"
              className={cn(input, "min-w-40 flex-1")}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={busy || changed.length === 0}>
          {busy && <Loader2Icon className="animate-spin" />}
          Simpan{changed.length > 1 ? ` (${changed.length} laga)` : ""}
        </Button>
        {message && (
          <p aria-live="polite" className={cn("text-xs", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
