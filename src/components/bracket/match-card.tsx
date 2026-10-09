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
  /** Garis keluar ke laga babak berikutnya (hijau setelah pemenang ditentukan). */
  connectOut?: boolean;
  /** Garis masuk dari pasangan laga babak sebelumnya. */
  connectIn?: boolean;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export function MatchCard({
  match,
  participants,
  roomName,
  slotLabels,
  connectOut,
  connectIn,
}: MatchCardProps) {
  const isLive = match.status === "ongoing";
  const a = match.participantAId ? participants.get(match.participantAId) : undefined;
  const b = match.participantBId ? participants.get(match.participantBId) : undefined;
  const winner = match.winnerId ? participants.get(match.winnerId) : undefined;
  const hasScore = match.scoreA !== null && match.scoreB !== null;
  const leader =
    isLive && hasScore && match.scoreA !== match.scoreB
      ? match.scoreA! > match.scoreB! ? "a" : "b"
      : null;

  const summary = [
    `Laga #${match.matchNumber}`,
    `${a?.name ?? slotLabels?.a.text ?? "TBD"} lawan ${b?.name ?? slotLabels?.b.text ?? "TBD"}`,
    hasScore ? `skor ${match.scoreA}–${match.scoreB}` : null,
    winner ? `pemenang ${winner.name}` : isLive ? "sedang berlangsung" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      id={match.id}
      data-status={match.status}
      role="group"
      aria-label={summary}
      className={cn(
        "relative w-52 shrink-0 rounded-lg border bg-card text-xs shadow-xs",
        isLive && "border-red-500/60 ring-1 ring-red-500/30",
        connectOut &&
          "after:absolute after:top-1/2 after:-right-(--half-gap) after:h-px after:w-(--half-gap)",
        connectOut && (winner ? "after:bg-emerald-500/60" : "after:bg-border"),
        connectIn &&
          "before:absolute before:top-1/2 before:-left-(--half-gap) before:h-px before:w-(--half-gap) before:bg-border",
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
        participant={a}
        score={match.scoreA}
        placeholder={slotLabels?.a}
        isLeading={leader === "a"}
        isWinner={!!match.winnerId && match.winnerId === match.participantAId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantAId}
      />
      <ParticipantRow
        participant={b}
        score={match.scoreB}
        placeholder={slotLabels?.b}
        isLeading={leader === "b"}
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
  isLeading,
  className,
}: {
  participant?: Participant;
  score: number | null;
  placeholder?: SlotLabel;
  isWinner: boolean;
  isLoser: boolean;
  /** Unggul sementara di laga yang sedang berlangsung. */
  isLeading: boolean;
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
      data-pid={participant.id}
      className={cn(
        "flex h-6 items-center gap-1.5 px-2 transition-colors",
        isWinner && "bg-emerald-500/10 font-semibold shadow-[inset_2px_0_0] shadow-emerald-500",
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
      {isWinner && (
        <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" aria-label="pemenang" />
      )}
      <span
        className={cn(
          "w-5 text-right tabular-nums",
          score === null && "text-muted-foreground",
          (isWinner || isLeading) && "font-bold",
          isLeading && "text-red-600 dark:text-red-400",
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}
