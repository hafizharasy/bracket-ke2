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

/**
 * Bagan eliminasi: satu kolom per babak. Tiap kartu menempati slot setinggi
 * sama (flex-1), dan dua slot dikelompokkan jadi satu pasangan. Karena itu
 * pusat kartu di babak berikutnya selalu sejajar dengan pusat pasangan asalnya,
 * dan garis penghubung cukup digambar dengan CSS:
 *   kartu ─┐
 *          ├─ kartu babak berikutnya
 *   kartu ─┘
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
  const rounds = [...groupByRound(matches)];

  return (
    <BracketScroller label={label} tone={tone}>
      <div className="flex w-max gap-8" style={{ ["--half-gap" as string]: HALF_GAP }}>
        {rounds.map(([round, roundMatches], i) => {
          const isFirst = i === 0;
          const isLast = i === rounds.length - 1;
          const pairs = isLast ? [roundMatches] : chunk(roundMatches, 2);
          return (
            <div key={round} data-round-col className="flex snap-start flex-col">
              <div className="mb-3 flex w-52 items-start justify-between gap-2 sm:w-60">
                <div>
                  <div className="font-display text-xs text-ink uppercase">
                    {round === LAST_ROOM_ROUND ? roundLabel(round) : roundLabel(round).replace(/ Ruangan$/, "")}
                  </div>
                  <div className="text-[10px] text-ink/45">
                    {round === LAST_ROOM_ROUND ? "Perebutan juara" : `${roundMatches.length * 2} peserta · ${roundMatches.length} laga`}
                  </div>
                </div>
                <span aria-hidden className="font-display text-2xl leading-none text-ink/12">
                  {String(i + 1).padStart(2, "0")}
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
                        !isLast &&
                          pair.length === 2 &&
                          "after:absolute after:top-1/4 after:bottom-1/4 after:-right-[calc(var(--half-gap)+1px)] after:w-0.5",
                        pairDone ? "after:bg-gold" : "after:bg-ink/20",
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
                            connectOut={!isLast}
                            connectIn={!isFirst}
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
