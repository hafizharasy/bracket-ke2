import { MatchCard } from "@/components/bracket/match-card";
import { groupByRound, roundLabel, type SlotLabels } from "@/lib/bracket";
import type { Match, Participant, Room } from "@/lib/types";

type BracketTreeProps = {
  matches: Match[];
  participants: Map<string, Participant>;
  /** Kalau diisi, nama ruangan ditampilkan di tiap kartu. */
  rooms?: Map<string, Room>;
  slotLabels?: Map<string, SlotLabels>;
};

/**
 * Bagan eliminasi: satu kolom per babak. Tiap kolom membagi tinggi secara
 * merata (justify-around) sehingga kartu sejajar dengan dua laga asalnya.
 */
export function BracketTree({ matches, participants, rooms, slotLabels }: BracketTreeProps) {
  const rounds = [...groupByRound(matches)];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex w-max gap-8">
        {rounds.map(([round, roundMatches], i) => (
          <div key={round} className="flex flex-col">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {roundLabel(round)}
              <span className="ml-1 font-normal">· {roundMatches.length} laga</span>
            </div>
            <div className="flex flex-1 flex-col justify-around gap-2">
              {roundMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  participants={participants}
                  roomName={rooms?.get(match.roomId)?.name}
                  slotLabels={slotLabels?.get(match.id)}
                  connector={i < rounds.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
