import { TrophyIcon } from "lucide-react";

import { WIN_TYPE_KEYS, WIN_TYPES, type WinType } from "@/lib/bracket";
import { formatPoints, type StandingRow, TIEBREAKERS } from "@/lib/final-standings";
import type { Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Judul kolom singkat per jenis kemenangan. */
const TYPE_COLUMNS: Record<WinType, string> = {
  empat: "4 pion",
  tiga: "3 pion",
  tiga_tercepat: "3 tercepat",
};

/**
 * Klasemen final round-robin. Tiap jenis kemenangan punya kolom jumlahnya
 * sendiri (poinnya di bawah judul kolom). `slots` = jumlah finalis; finalis yang belum
 * diketahui (semifinal belum selesai) tampil sebagai "Pemenang Semifinal #k".
 */
export function FinalStandingsTable({
  rows,
  participants,
  pending,
  complete,
}: {
  rows: StandingRow[];
  participants: Map<string, Participant>;
  /** Nomor semifinal yang pemenangnya belum diketahui. */
  pending: number[];
  /** Semua laga final sudah selesai → peringkat 1 adalah juara. */
  complete: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border-2 border-line bg-surface shadow-[4px_4px_0_0_var(--color-gold)]">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Klasemen final</caption>
          <thead className="bg-navy text-left font-display text-[10px] tracking-wide text-gold uppercase">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Finalis</th>
              <th className="px-3 py-2 text-center font-medium">Main</th>
              <th className="px-3 py-2 text-center font-medium">Menang</th>
              <th className="px-3 py-2 text-center font-medium">Kalah</th>
              {WIN_TYPE_KEYS.map((type) => (
                <th key={type} className="px-2 py-2 text-center font-medium" title={WIN_TYPES[type].label}>
                  {TYPE_COLUMNS[type]}
                  <span className="block font-sans text-[9px] font-normal tracking-normal text-gold/70 normal-case">
                    +{formatPoints(WIN_TYPES[type].points)}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">Poin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((row) => {
              const p = participants.get(row.participantId);
              const champion = complete && row.rank === 1 && !row.tied;
              return (
                <tr key={row.participantId} className={cn(champion && "bg-gold-soft")}>
                  <td className="px-3 py-2 font-display text-ink/70 tabular-nums">{row.rank}{row.tied && "*"}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {champion && <TrophyIcon className="size-4 text-crimson" aria-label="Juara" />}
                      {p?.name ?? row.participantId}
                    </span>
                    {p?.teamOrClub && <span className="block text-xs text-ink/50">{p.teamOrClub}</span>}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{row.played}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{row.wins}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{row.losses}</td>
                  {WIN_TYPE_KEYS.map((type) => (
                    <td key={type} className={cn("px-2 py-2 text-center tabular-nums", !row.byType[type] && "text-ink/30")}>
                      {row.byType[type]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-display text-base text-crimson tabular-nums">{formatPoints(row.points)}</td>
                </tr>
              );
            })}
            {pending.map((k) => (
              <tr key={`sf-${k}`} className="text-ink/45">
                <td className="px-3 py-2">–</td>
                <td className="px-3 py-2 italic" colSpan={6 + WIN_TYPE_KEYS.length}>Pemenang Semifinal #{k}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/60">
        Poin per kemenangan:{" "}
        {Object.values(WIN_TYPES)
          .map((w) => `${w.label.replace(/^Menang (telak )?/, "").replace(/[()]/g, "")} +${formatPoints(w.points)}`)
          .join(" · ")}
        ; kalah 0. Bila poin sama: {TIEBREAKERS.join(" → ")} (terbanyak di atas).
        {rows.some((r) => r.tied) && " * masih seri — ditentukan panitia."}
      </p>
    </div>
  );
}
