"use client";

import { SearchIcon, ShieldAlertIcon, UsersIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { filterViolations, groupViolationsByParticipant, tally, type ViolationRecapRow } from "@/lib/recap";
import { cn } from "@/lib/utils";

const PAGE = 50;
const dateTime = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Rekap pelanggaran: ringkasan (total, peserta, per jenis, per ruangan,
 * peserta berulang) yang bisa diklik untuk menyaring, lalu daftar
 * pelanggaran (cari peserta) atau tampilan per peserta.
 */
export function ViolationRecap({ rows }: { rows: ViolationRecapRow[] }) {
  const [type, setType] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "participant">("list");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(
    () => filterViolations(rows, { type: type ?? undefined, roomName: room ?? undefined, q: query }),
    [rows, type, room, query],
  );

  const byType = useMemo(() => tally(rows.filter((v) => !room || v.roomName === room), (v) => v.type), [rows, room]);
  const byRoom = useMemo(() => tally(rows.filter((v) => !type || v.type === type), (v) => v.roomName), [rows, type]);
  const byParticipant = useMemo(() => groupViolationsByParticipant(filtered), [filtered]);
  const repeat = byParticipant.filter((g) => g.count > 1).length;
  const reset = () => setShown(PAGE);
  const maxRoom = Math.max(1, ...byRoom.map(([, n]) => n));

  const chip = (active: boolean) =>
    cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted");

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Ringkasan pelanggaran" className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Pelanggaran", value: filtered.length, icon: ShieldAlertIcon },
          { label: "Peserta terlibat", value: new Set(filtered.map((v) => v.participant.id)).size, icon: UsersIcon },
          { label: "Peserta berulang (≥2)", value: repeat, icon: UsersIcon },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <Icon className="size-5 text-orange-600" aria-hidden />
            <div>
              <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
              <div className="text-xs text-muted-foreground sm:text-sm">{label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Per jenis" className="flex min-w-0 flex-col gap-2">
          <h2 className="font-semibold">Per jenis</h2>
          <div className="flex flex-wrap gap-1.5">
            {byType.map(([t, n]) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(type === t ? null : t); reset(); }} className={chip(type === t)}>
                {t} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            ))}
            {byType.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pelanggaran.</p>}
          </div>
        </section>
        <section aria-label="Per ruangan" className="flex min-w-0 flex-col gap-2">
          <h2 className="font-semibold">Per ruangan</h2>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
            {byRoom.map(([r, n]) => (
              <button key={r} type="button" aria-pressed={room === r} onClick={() => { setRoom(room === r ? null : r); reset(); }}
                className={cn("col-span-3 grid grid-cols-subgrid items-center rounded-md px-1 text-left hover:bg-muted", room === r && "bg-primary/10 font-medium")}>
                <span className="whitespace-nowrap">{r}</span>
                <span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-orange-500" style={{ width: `${(n / maxRoom) * 100}%` }} /></span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="Daftar pelanggaran" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Cari peserta</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Cari nama atau ID peserta…"
              className="h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <div role="group" aria-label="Tampilan" className="flex rounded-lg border p-0.5 text-sm">
            {(["list", "participant"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); reset(); }}
                className={cn("rounded-md px-3 py-1", view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {v === "list" ? "Semua catatan" : "Per peserta"}
              </button>
            ))}
          </div>
        </div>
        {(type || room) && (
          <div className="flex flex-wrap gap-1.5 text-sm">
            {[type, room].filter(Boolean).map((f) => (
              <button key={f} type="button" onClick={() => { if (f === type) setType(null); else setRoom(null); reset(); }}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5" aria-label={`Hapus filter ${f}`}>
                {f} <XIcon className="size-3" />
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {view === "list" ? `${filtered.length} catatan` : `${byParticipant.length} peserta`}
        </p>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada pelanggaran yang cocok.</p>
        ) : view === "list" ? (
          <ul className="divide-y rounded-xl border bg-card">
            {filtered.slice(0, shown).map((v) => (
              <li key={v.id} className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{dateTime.format(new Date(v.occurredAt))}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{v.participant.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">{v.participant.id.toUpperCase()}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[v.sessionName, v.roomName, v.matchLabel].filter(Boolean).join(" · ")} · oleh {v.recordedBy}
                  </span>
                  {v.note && <span className="block text-xs italic">“{v.note}”</span>}
                </span>
                <span className="shrink-0 self-start rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs text-orange-800 sm:self-center dark:text-orange-300">{v.type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {byParticipant.slice(0, shown).map((g) => (
              <li key={g.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{g.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">{g.id.toUpperCase()} · {g.roomName}</span>
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", g.count > 1 ? "bg-red-600 text-white" : "bg-muted")}>{g.count}×</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.types.map(({ type: t, count: n }) => (
                    <span key={t} className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-800 dark:text-orange-300">{t}{n > 1 && ` ×${n}`}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {shown < (view === "list" ? filtered.length : byParticipant.length) && (
          <Button variant="outline" className="self-center" onClick={() => setShown((n) => n + PAGE)}>Tampilkan lebih banyak</Button>
        )}
      </section>
    </div>
  );
}
