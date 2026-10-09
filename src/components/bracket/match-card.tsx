import { CheckIcon } from "lucide-react";

import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

type MatchCardProps = {
  match: Match;
  participants: Map<string, Participant>;
  roomName?: string;
  /** Tampilkan garis penghubung ke babak berikutnya. */
  connector?: boolean;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function MatchCard({ match, participants, roomName, connector }: MatchCardProps) {
  const isLive = match.status === "ongoing";

  return (
    <div
      id={match.id}
      data-status={match.status}
      className={cn(
        "relative w-52 shrink-0 rounded-lg border bg-card text-xs shadow-xs",
        isLive && "border-red-500/60 ring-1 ring-red-500/30",
        connector &&
          "after:absolute after:top-1/2 after:-right-4 after:h-px after:w-4 after:bg-border",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1 text-[10px] text-muted-foreground">
        <span className="truncate">
          #{match.matchNumber}
          {roomName ? ` · ${roomName}` : ""}
          {match.scheduledAt ? ` · ${timeFormat.format(new Date(match.scheduledAt))}` : ""}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            LIVE
          </span>
        ) : match.status === "done" ? (
          <span>Selesai</span>
        ) : null}
      </div>
      <ParticipantRow
        participant={match.participantAId ? participants.get(match.participantAId) : undefined}
        score={match.scoreA}
        isWinner={!!match.winnerId && match.winnerId === match.participantAId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantAId}
      />
      <ParticipantRow
        participant={match.participantBId ? participants.get(match.participantBId) : undefined}
        score={match.scoreB}
        isWinner={!!match.winnerId && match.winnerId === match.participantBId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantBId}
        className="border-t"
      />
    </div>
  );
}

function ParticipantRow({
  participant,
  score,
  isWinner,
  isLoser,
  className,
}: {
  participant?: Participant;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-6 items-center gap-1.5 px-2",
        isWinner && "bg-emerald-500/10 font-semibold",
        isLoser && "text-muted-foreground",
        className,
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate", !participant && "italic text-muted-foreground")}>
        {participant?.name ?? "Menunggu pemenang"}
      </span>
      {isWinner && <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />}
      <span className="w-4 text-right tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
