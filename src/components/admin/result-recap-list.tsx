"use client";

import { CameraIcon, PencilLineIcon, SearchIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterResults, type ResultRecapRow } from "@/lib/recap";
import type { MatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 50;
const STATUS: Record<MatchStatus, { label: string; className: string }> = {
  done: { label: "Selesai", className: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300" },
  ongoing: { label: "LIVE", className: "bg-red-600 text-white" },
  scheduled: { label: "Terjadwal", className: "" },
};
const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Daftar rekap hasil pertandingan: cari peserta, filter status & babak,
 * tampil bertahap. Tabel di layar lebar, kartu di ponsel. Klik → detail laga.
 */
export function ResultRecapList({ rows }: { rows: ResultRecapRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | MatchStatus>("all");
  const [round, setRound] = useState("all");
  const [onlyCorrected, setOnlyCorrected] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const rounds = useMemo(() => [...new Map(rows.map((r) => [r.round, r.roundLabel]))].sort((a, b) => a[0] - b[0]), [rows]);
  const filtered = useMemo(
    () =>
      filterResults(rows, {
        status: status === "all" ? undefined : status,
        round: round === "all" ? undefined : Number(round),
        q: query,
        onlyCorrected,
      }),
    [rows, query, status, round, onlyCorrected],
  );
  const visible = filtered.slice(0, shown);
  const reset = () => setShown(PAGE);

  const control = "h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const name = (p: ResultRecapRow["participantA"], winner: ResultRecapRow["winner"]) =>
    p ? <span className={cn(winner?.id === p.id && "font-semibold")}>{p.name}</span> : <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Cari peserta atau ID laga</span>
          <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Cari peserta atau ID laga…" className={cn(control, "w-full pl-9")} />
        </label>
        <select aria-label="Filter status" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); reset(); }} className={control}>
          <option value="all">Semua status</option>
          <option value="done">Selesai</option>
          <option value="ongoing">Berlangsung</option>
          <option value="scheduled">Terjadwal</option>
        </select>
        <select aria-label="Filter babak" value={round} onChange={(e) => { setRound(e.target.value); reset(); }} className={control}>
          <option value="all">Semua babak</option>
          {rounds.map(([n, label]) => (
            <option key={n} value={n}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyCorrected} onChange={(e) => { setOnlyCorrected(e.target.checked); reset(); }} className="size-4" />
          Hanya yang dikoreksi
        </label>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} laga{filtered.length !== rows.length && ` dari ${rows.length}`}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada laga yang cocok.</p>
      ) : (
        <>
          {/* Layar lebar: tabel */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Laga</th>
                  <th className="px-3 py-2 font-medium">Peserta</th>
                  <th className="px-3 py-2 text-center font-medium">Skor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Dicatat</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={r.matchId} className="hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link href={`/admin/laga/${r.matchId}`} className="font-medium hover:underline">
                        {r.roundLabel} #{r.matchNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.sessionName} · {r.roomName}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{name(r.participantA, r.winner)}</div>
                      <div>{name(r.participantB, r.winner)}</div>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      <div>{r.scoreA ?? "–"}</div>
                      <div>{r.scoreB ?? "–"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={STATUS[r.status].className}>{STATUS[r.status].label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.recordedAt ? (
                        <>
                          <div>{time.format(new Date(r.recordedAt))} · {r.recordedBy}</div>
                          <div className="flex gap-2">
                            {r.hasProof && <span className="flex items-center gap-1"><CameraIcon className="size-3" /> bukti</span>}
                            {r.corrections > 0 && <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><PencilLineIcon className="size-3" /> {r.corrections}× koreksi</span>}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ponsel: kartu */}
          <ul className="flex flex-col gap-2 md:hidden">
            {visible.map((r) => (
              <li key={r.matchId}>
                <Link href={`/admin/laga/${r.matchId}`} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.roundLabel} #{r.matchNumber}</span>
                    <Badge variant="outline" className={STATUS[r.status].className}>{STATUS[r.status].label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.sessionName} · {r.roomName}</div>
                  {[
                    { side: "a", person: r.participantA, score: r.scoreA },
                    { side: "b", person: r.participantB, score: r.scoreB },
                  ].map(({ side, person, score }) => (
                    <div key={side} className="flex justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        {name(person, r.winner)}
                        {person && r.winner?.id === person.id && <TrophyIcon className="size-3.5 shrink-0 text-amber-500" />}
                      </span>
                      <span className="tabular-nums">{score ?? "–"}</span>
                    </div>
                  ))}
                  {r.corrections > 0 && <span className="text-xs text-amber-700 dark:text-amber-400">{r.corrections}× koreksi</span>}
                </Link>
              </li>
            ))}
          </ul>

          {shown < filtered.length && (
            <Button variant="outline" className="self-center" onClick={() => setShown((n) => n + PAGE)}>
              Tampilkan {Math.min(PAGE, filtered.length - shown)} laga lagi
            </Button>
          )}
        </>
      )}
    </div>
  );
}
