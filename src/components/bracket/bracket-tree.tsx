import { BracketScroller } from "@/components/bracket/bracket-scroller";
import { MatchCard } from "@/components/bracket/match-card";
import { groupByRound, LAST_ROOM_ROUND, roundLabel, type SlotLabels } from "@/lib/bracket";
import type { Match, Participant, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

type BracketTreeProps = {
  matches: Match[];
  participants: Map<string, Participant>;
  /** Kalau diisi, nama ruangan ditampilkan di tiap kartu. */
  rooms?: Map<string, Room>;
  slotLabels?: Map<string, SlotLabels>;
  /** Nomor undian peserta (urutan babak 1 di ruangannya). */
  seeds?: Map<string, number>;
  /** Nama area gulir untuk pembaca layar, mis. "Bagan Sesi 1 Ruangan 3". */
  label: string;
  tone?: "card" | "background" | "cream";
};

// Setengah jarak antarkolom (gap-8 = 2rem): garis penghubung bertemu di tengahnya.
const HALF_GAP = "1rem";

/** "left": bagan mengalir ke kanan; "right": ke kiri (cermin); "center": final, garis masuk dari dua sisi. */
type Side = "left" | "right" | "center";
type Column = { round: number; side: Side; matches: Match[] };

/**
 * Susun kolom bagan dua sisi dari tautan `nextMatchId`: final ruangan di
 * tengah, laga asal slot A di sisi kiri dan slot B di sisi kanan, tiap kolom
 * urut dari atas. Mengembalikan null bila pohonnya tidak lengkap (mis. data
 * lama), supaya bagan jatuh ke tampilan satu arah.
 */
function twoSidedColumns(matches: Match[]): Column[] | null {
  const top = Math.max(...matches.map((m) => m.round));
  const roots = matches.filter((m) => m.round === top);
  if (roots.length !== 1) return null;
  const feeders = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.nextMatchId) feeders.set(m.nextMatchId, [...(feeders.get(m.nextMatchId) ?? []), m]);
  }
  for (const list of feeders.values()) list.sort((a, b) => a.matchNumber - b.matchNumber);
  const halves = feeders.get(roots[0].id) ?? [];
  if (halves.length !== 2) return null;

  const sideColumns = (start: Match, side: Side) => {
    const columns: Column[] = [];
    let level = [start];
    while (level.length) {
      if (level.some((m) => m.round !== level[0].round)) return null;
      columns.push({ round: level[0].round, side, matches: level });
      const next = level.flatMap((m) => feeders.get(m.id) ?? []);
      if (next.length && next.length !== level.length * 2) return null;
      level = next;
    }
    return columns;
  };
  const left = sideColumns(halves[0], "left");
  const right = sideColumns(halves[1], "right");
  if (!left || !right) return null;
  return [...left.reverse(), { round: top, side: "center", matches: roots }, ...right];
}

/**
 * Bagan eliminasi dua sisi: sisi kiri mengalir ke kanan, sisi kanan ke kiri,
 * bertemu di final ruangan di tengah. Tiap kartu menempati slot setinggi
 * sama (flex-1), dan dua slot dikelompokkan jadi satu pasangan. Karena itu
 * pusat kartu di babak berikutnya selalu sejajar dengan pusat pasangan asalnya,
 * dan garis penghubung cukup digambar dengan CSS:
 *   kartu ─┐                    ┌─ kartu
 *          ├─ kartu ─ final ─ kartu ─┤
 *   kartu ─┘                    └─ kartu
 */
export function BracketTree({
  matches,
  participants,
  rooms,
  slotLabels,
  seeds,
  label,
  tone,
}: BracketTreeProps) {
  // Tanpa pohon lengkap: satu arah, kolom terakhir menjadi "final" tanpa garis keluar.
  const columns =
    twoSidedColumns(matches) ??
    [...groupByRound(matches)].map(([round, list], i, all): Column => ({
      round,
      side: i === all.length - 1 ? "center" : "left",
      matches: list,
    }));
  const firstRound = Math.min(...columns.map((c) => c.round));
  const twoSided = columns.some((c) => c.side === "right");

  return (
    <BracketScroller label={label} tone={tone}>
      <div className="flex w-max gap-8" style={{ ["--half-gap" as string]: HALF_GAP }}>
        {columns.map(({ round, side, matches: columnMatches }) => {
          const isFirst = round === firstRound;
          const pairs = side === "center" ? [columnMatches] : chunk(columnMatches, 2);
          const lineIn = isFirst ? undefined : "in";
          const lineLeft = side === "left" ? lineIn : side === "right" ? "out" : twoSided || !isFirst ? "in" : undefined;
          const lineRight = side === "left" ? "out" : side === "right" ? lineIn : twoSided ? "in" : undefined;
          return (
            <div key={`${side}-${round}`} data-round-col className="flex snap-start flex-col">
              <div className="mb-3 flex w-52 items-start justify-between gap-2 sm:w-60">
                <div>
                  <div className="font-display text-xs text-ink uppercase">
                    {round === LAST_ROOM_ROUND ? roundLabel(round) : roundLabel(round).replace(/ Ruangan$/, "")}
                  </div>
                  <div className="text-[10px] text-ink/45">
                    {side === "center"
                      ? "Perebutan juara"
                      : twoSided
                        ? `Sisi ${side === "left" ? "kiri" : "kanan"} · ${columnMatches.length} laga`
                        : `${columnMatches.length * 2} peserta · ${columnMatches.length} laga`}
                  </div>
                </div>
                <span aria-hidden className="font-display text-2xl leading-none text-ink/12">
                  {String(round - firstRound + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-1 flex-col">
                {pairs.map((pair) => {
                  const pairDone = pair.length === 2 && pair.every((m) => m.winnerId);
                  return (
                    <div
                      key={pair[0].id}
                      className={cn(
                        "relative flex flex-1 flex-col",
                        // Garis vertikal yang menyatukan dua laga ke laga berikutnya.
                        pair.length === 2 &&
                          side === "left" &&
                          "after:absolute after:top-1/4 after:bottom-1/4 after:-right-[calc(var(--half-gap)+1px)] after:w-0.5",
                        pair.length === 2 &&
                          side === "right" &&
                          "before:absolute before:top-1/4 before:bottom-1/4 before:-left-[calc(var(--half-gap)+1px)] before:w-0.5",
                        side === "left" && (pairDone ? "after:bg-gold" : "after:bg-ink/20"),
                        side === "right" && (pairDone ? "before:bg-gold" : "before:bg-ink/20"),
                      )}
                    >
                      {pair.map((match) => (
                        <div key={match.id} className="flex flex-1 items-center py-1.5">
                          <MatchCard
                            match={match}
                            participants={participants}
                            roomName={rooms?.get(match.roomId)?.name}
                            slotLabels={slotLabels?.get(match.id)}
                            seeds={seeds}
                            lineLeft={lineLeft}
                            lineRight={lineRight}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </BracketScroller>
  );
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
