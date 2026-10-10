import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { roundLabel, type SlotLabels } from "@/lib/bracket";
import { canInputResult } from "@/lib/room-matches";
import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Satu baris laga di daftar pengawas; ketuk untuk membuka form input hasil. */
export function RoomMatchRow({
  match,
  participants,
  slotLabels,
}: {
  match: Match;
  participants: Map<string, Participant>;
  slotLabels?: SlotLabels;
}) {
  const a = match.participantAId ? participants.get(match.participantAId) : undefined;
  const b = match.participantBId ? participants.get(match.participantBId) : undefined;
  const actionable = canInputResult(match);
  const isLive = match.status === "ongoing";

  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{roundLabel(match.round)}</span>
          <span>#{match.matchNumber}</span>
          {match.scheduledAt && <span>· {timeFormat.format(new Date(match.scheduledAt))}</span>}
          {isLive && (
            <Badge className="ml-auto bg-red-600 text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </Badge>
          )}
          {match.status === "done" && (
            <Badge variant="secondary" className="ml-auto">
              Selesai
            </Badge>
          )}
        </div>
        <Side
          name={a?.name ?? slotLabels?.a.text}
          empty={!a}
          score={match.scoreA}
          winner={!!match.winnerId && match.winnerId === match.participantAId}
        />
        <Side
          name={b?.name ?? slotLabels?.b.text}
          empty={!b}
          score={match.scoreB}
          winner={!!match.winnerId && match.winnerId === match.participantBId}
        />
      </div>
      {actionable && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-xl border bg-card p-3",
    isLive && "border-red-500/60",
    actionable && "transition-colors hover:bg-muted/50 active:bg-muted",
    !actionable && "opacity-70",
  );

  return actionable ? (
    <Link href={`/ruangan/laga/${match.id}`} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Side({
  name,
  empty,
  score,
  winner,
}: {
  name?: string;
  empty: boolean;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", winner && "font-semibold")}>
      <span className={cn("min-w-0 flex-1 truncate", empty && "italic text-muted-foreground")}>
        {name ?? "Menunggu pemenang"}
      </span>
      <span className="w-6 text-right tabular-nums">{score ?? "–"}</span>
    </div>
  );
}
