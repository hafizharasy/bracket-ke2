"use client";

import { LockIcon, Loader2Icon, RotateCcwIcon, ShuffleIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { savePairings } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

export type PairingPlayer = { id: string; name: string; club: string | null };

function shuffle<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Susun pasangan babak 1 satu ruangan. `initial` = urutan peserta saat ini
 * (indeks 2k vs 2k+1). Ketuk dua peserta untuk menukar posisinya; peserta
 * cadangan (belum masuk bagan) bisa ditukar dengan yang sudah ada.
 */
export function PairingEditor({
  sessionId,
  roomId,
  initial,
  bench,
  locked,
  slots,
}: {
  sessionId: string;
  roomId: string;
  initial: PairingPlayer[];
  /** Peserta ruangan & sesi ini yang belum masuk babak 1. */
  bench: PairingPlayer[];
  locked: boolean;
  /** Jumlah slot babak 1 (16). */
  slots: number;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<PairingPlayer[]>(initial.length > 0 ? initial : bench.slice(0, slots));
  const [reserve, setReserve] = useState<PairingPlayer[]>(initial.length > 0 ? bench : bench.slice(slots));
  const [picked, setPicked] = useState<{ list: "order" | "reserve"; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = order.map((p) => p.id).join() !== initial.map((p) => p.id).join();
  const pairs = Array.from({ length: Math.ceil(order.length / 2) }, (_, k) => [order[2 * k], order[2 * k + 1]] as const);
  const sameClub = pairs.filter(([a, b]) => a?.club && b?.club && a.club === b.club).length;
  const incomplete = order.length !== slots;

  function pick(list: "order" | "reserve", index: number) {
    if (locked) return;
    setMessage(null);
    if (!picked) return setPicked({ list, index });
    if (picked.list === list && picked.index === index) return setPicked(null);
    // Tukar dua peserta (antar posisi bagan, atau bagan ↔ cadangan).
    const nextOrder = [...order];
    const nextReserve = [...reserve];
    const get = (l: typeof list, i: number) => (l === "order" ? nextOrder[i] : nextReserve[i]);
    const set = (l: typeof list, i: number, v: PairingPlayer) => (l === "order" ? (nextOrder[i] = v) : (nextReserve[i] = v));
    const first = get(picked.list, picked.index);
    const second = get(list, index);
    set(picked.list, picked.index, second);
    set(list, index, first);
    setOrder(nextOrder);
    setReserve(nextReserve);
    setPicked(null);
  }

  async function save() {
    setBusy(true);
    const result = await savePairings({ sessionId, roomId, order: order.map((p) => p.id) });
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: `Pasangan tersimpan${result.simulated ? " (mode simulasi)" : ""}.` } : { ok: false, text: result.error });
    if (result.ok) router.refresh();
  }

  const isPicked = (list: "order" | "reserve", index: number) => picked?.list === list && picked.index === index;
  const chip = (p: PairingPlayer | undefined, list: "order" | "reserve", index: number) => (
    <button
      type="button"
      onClick={() => pick(list, index)}
      disabled={locked || !p}
      aria-pressed={isPicked(list, index)}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-lg border bg-background px-2.5 py-1.5 text-left text-sm transition-colors",
        !locked && "hover:border-primary/60",
        isPicked(list, index) && "border-primary bg-primary/10 ring-2 ring-primary/30",
        !p && "border-dashed text-muted-foreground",
      )}
    >
      <span className="truncate font-medium">{p?.name ?? "Kosong"}</span>
      {p && <span className="truncate text-xs text-muted-foreground">{p.club ?? "Tanpa sekolah"} · {p.id.toUpperCase()}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {locked ? (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/50 p-3 text-sm">
          <LockIcon className="size-4" />
          Laga di ruangan ini sudah dimulai, susunan pasangan dikunci.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setOrder(shuffle(order)); setPicked(null); setMessage(null); }}>
            <ShuffleIcon /> Acak ulang
          </Button>
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => { setOrder(initial); setReserve(bench); setPicked(null); }}>
            <RotateCcwIcon /> Kembalikan
          </Button>
          <span className="text-xs text-muted-foreground">
            {picked ? "Pilih peserta kedua untuk ditukar." : "Ketuk dua peserta untuk menukar posisinya."}
          </span>
          <Button size="sm" className="ml-auto" onClick={save} disabled={busy || !dirty || incomplete}>
            {busy && <Loader2Icon className="animate-spin" />} Simpan pasangan
          </Button>
        </div>
      )}

      {(sameClub > 0 || incomplete) && (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="size-4" />
          {incomplete && `Babak 1 butuh ${slots} peserta, saat ini ${order.length}. `}
          {sameClub > 0 && `${sameClub} pasangan berasal dari sekolah yang sama.`}
        </p>
      )}
      {message && (
        <p aria-live="polite" className={cn("text-sm", message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
          {message.text}
        </p>
      )}

      <ol className="grid gap-2 md:grid-cols-2">
        {pairs.map(([a, b], k) => {
          const clash = a?.club && b?.club && a.club === b.club;
          return (
            <li key={k} className={cn("flex items-center gap-2 rounded-xl border bg-card p-2", clash && "border-amber-500/60")}>
              <span className="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">#{k + 1}</span>
              {chip(a, "order", 2 * k)}
              <span className="text-xs text-muted-foreground">vs</span>
              {chip(b, "order", 2 * k + 1)}
            </li>
          );
        })}
      </ol>

      {reserve.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Cadangan / belum masuk bagan ({reserve.length})</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {reserve.map((p, i) => (
              <div key={p.id} className="flex">{chip(p, "reserve", i)}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
