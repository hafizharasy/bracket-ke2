import { CheckIcon, HourglassIcon } from "lucide-react";

import type { SlotLabel, SlotLabels } from "@/lib/bracket";
import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

type MatchCardProps = {
  match: Match;
  participants: Map<string, Participant>;
  roomName?: string;
  /** Teks untuk slot yang belum terisi peserta. */
  slotLabels?: SlotLabels;
  /** Tampilkan garis penghubung ke babak berikutnya. */
  connector?: boolean;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function MatchCard({ match, participants, roomName, slotLabels, connector }: MatchCardProps) {
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
        placeholder={slotLabels?.a}
        isWinner={!!match.winnerId && match.winnerId === match.participantAId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantAId}
      />
      <ParticipantRow
        participant={match.participantBId ? participants.get(match.participantBId) : undefined}
        score={match.scoreB}
        placeholder={slotLabels?.b}
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
  placeholder = { text: "Menunggu pemenang", live: false },
  isWinner,
  isLoser,
  className,
}: {
  participant?: Participant;
  score: number | null;
  placeholder?: SlotLabel;
  isWinner: boolean;
  isLoser: boolean;
  className?: string;
}) {
  if (!participant) {
    return (
      <div
        title={placeholder.live ? `${placeholder.text} (sedang bertanding)` : placeholder.text}
        className={cn(
          "flex h-6 items-center gap-1.5 bg-muted/40 px-2 text-muted-foreground",
          className,
        )}
      >
        <HourglassIcon className="size-3 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate italic">{placeholder.text}</span>
        {placeholder.live && (
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-label="sedang bertanding" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-6 items-center gap-1.5 px-2",
        isWinner && "bg-emerald-500/10 font-semibold",
        isLoser && "text-muted-foreground",
        className,
      )}
    >
      <span
        title={[participant.name, participant.teamOrClub].filter(Boolean).join(" · ")}
        className="min-w-0 flex-1 truncate"
      >
        {participant.name}
      </span>
      {isWinner && <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />}
      <span className="w-4 text-right tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
