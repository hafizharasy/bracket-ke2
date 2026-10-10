import { TrophyIcon } from "lucide-react";

import { WIN_TYPES } from "@/lib/bracket";
import { formatPoints, type StandingRow } from "@/lib/final-standings";
import type { Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Klasemen final round-robin. `slots` = jumlah finalis; finalis yang belum
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
      <div className="overflow-x-auto rounded-xl border-2 border-ink bg-white shadow-[4px_4px_0_0_var(--color-gold)]">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Klasemen final</caption>
          <thead className="bg-ink text-left font-display text-[10px] tracking-wide text-gold uppercase">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Finalis</th>
              <th className="px-3 py-2 text-center font-medium">Main</th>
              <th className="px-3 py-2 text-center font-medium">Menang</th>
              <th className="px-3 py-2 text-center font-medium">Kalah</th>
              <th className="px-3 py-2 text-center font-medium" title="Menang telak 4 pion berjajar">4 pion</th>
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
                  <td className="px-3 py-2 text-center tabular-nums">{row.fourInRow}</td>
                  <td className="px-3 py-2 text-center font-display text-base text-crimson tabular-nums">{formatPoints(row.points)}</td>
                </tr>
              );
            })}
            {pending.map((k) => (
              <tr key={`sf-${k}`} className="text-ink/45">
                <td className="px-3 py-2">–</td>
                <td className="px-3 py-2 italic" colSpan={6}>Pemenang Semifinal #{k}</td>
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
        ; kalah 0. Urutan poin sama: head-to-head, lalu jumlah menang.
        {rows.some((r) => r.tied) && " * masih seri — ditentukan panitia."}
      </p>
    </div>
  );
}
