import { MatchCard } from "@/components/bracket/match-card";
import { groupByRound, roundLabel, type SlotLabels } from "@/lib/bracket";
import type { Match, Participant, Room } from "@/lib/types";
import { cn } from "@/lib/utils";

type BracketTreeProps = {
  matches: Match[];
  participants: Map<string, Participant>;
  /** Kalau diisi, nama ruangan ditampilkan di tiap kartu. */
  rooms?: Map<string, Room>;
  slotLabels?: Map<string, SlotLabels>;
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
export function BracketTree({ matches, participants, rooms, slotLabels }: BracketTreeProps) {
  const rounds = [...groupByRound(matches)];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex w-max gap-8" style={{ ["--half-gap" as string]: HALF_GAP }}>
        {rounds.map(([round, roundMatches], i) => {
          const isFirst = i === 0;
          const isLast = i === rounds.length - 1;
          const pairs = isLast ? [roundMatches] : chunk(roundMatches, 2);
          return (
            <div key={round} className="flex flex-col">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {roundLabel(round)}
                <span className="ml-1 font-normal">· {roundMatches.length} laga</span>
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
                          "after:absolute after:top-1/4 after:bottom-1/4 after:-right-(--half-gap) after:w-px",
                        pairDone ? "after:bg-emerald-500/60" : "after:bg-border",
                      )}
                    >
                      {pair.map((match) => (
                        <div key={match.id} className="flex flex-1 items-center py-1">
                          <MatchCard
                            match={match}
                            participants={participants}
                            roomName={rooms?.get(match.roomId)?.name}
                            slotLabels={slotLabels?.get(match.id)}
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
    </div>
  );
}

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
