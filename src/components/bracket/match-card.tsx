import { CheckIcon, Clock3Icon } from "lucide-react";

import { type SlotLabel, type SlotLabels, WIN_TYPES, type WinType } from "@/lib/bracket";
import { formatPoints, winPoints } from "@/lib/final-standings";
import type { Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

type MatchCardProps = {
  match: Match;
  participants: Map<string, Participant>;
  roomName?: string;
  /** Teks untuk slot yang belum terisi peserta. */
  slotLabels?: SlotLabels;
  /** Nomor undian peserta di ruangannya (urutan babak 1). */
  seeds?: Map<string, number>;
  /** Garis keluar ke laga babak berikutnya (emas setelah pemenang ditentukan). */
  connectOut?: boolean;
  /** Garis masuk dari pasangan laga babak sebelumnya. */
  connectIn?: boolean;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Label & warna status di pojok kartu. */
export function matchBadge(match: Match) {
  if (match.status === "ongoing") return { label: "Berlangsung", className: "bg-crimson text-white", dot: true };
  if (match.status === "done") return { label: "Selesai", className: "bg-gold text-ink", dot: false };
  if (match.participantAId && match.participantBId) return { label: "Berikutnya", className: "bg-ink text-gold", dot: false };
  return { label: "Menunggu", className: "bg-ink/8 text-ink/45", dot: false };
}

export function MatchCard({ match, participants, roomName, slotLabels, seeds, connectOut, connectIn }: MatchCardProps) {
  const isLive = match.status === "ongoing";
  const a = match.participantAId ? participants.get(match.participantAId) : undefined;
  const b = match.participantBId ? participants.get(match.participantBId) : undefined;
  const winner = match.winnerId ? participants.get(match.winnerId) : undefined;
  const hasScore = match.scoreA !== null && match.scoreB !== null;
  // Final round-robin: tampilkan poin dari jenis kemenangan, bukan skor.
  const points = match.winType && match.winnerId ? formatPoints(winPoints(match.winType)) : null;
  const display = (id: string | null, score: number | null) =>
    points !== null ? (id === match.winnerId ? `+${points}` : "0") : score;
  const leader =
    isLive && hasScore && match.scoreA !== match.scoreB ? (match.scoreA! > match.scoreB! ? "a" : "b") : null;
  const badge = matchBadge(match);
  // Final: jenis kemenangan menentukan poin, mis. "Menang telak (4 pion berjajar)".
  const winTypeLabel = points !== null && match.winType ? WIN_TYPES[match.winType as WinType]?.label : null;

  const summary = [
    `Laga #${match.matchNumber}`,
    `${a?.name ?? slotLabels?.a.text ?? "TBD"} lawan ${b?.name ?? slotLabels?.b.text ?? "TBD"}`,
    hasScore ? `skor ${match.scoreA}–${match.scoreB}` : null,
    points !== null ? `${points} poin untuk pemenang` : null,
    winner ? `pemenang ${winner.name}` : isLive ? "sedang berlangsung" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      id={match.id}
      data-match-id={match.id}
      data-status={match.status}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`${summary}. Lihat detail.`}
      className={cn(
        "relative w-52 shrink-0 cursor-pointer rounded-lg border-2 bg-white text-xs transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-gold sm:w-60",
        isLive ? "border-crimson shadow-[4px_4px_0_0_var(--color-gold)]" : "border-ink shadow-[3px_3px_0_0_#e4d6b4]",
        connectOut && "after:absolute after:top-1/2 after:-right-[calc(var(--half-gap)+2px)] after:h-0.5 after:w-(--half-gap)",
        connectOut && (winner ? "after:bg-gold" : "after:bg-ink/20"),
        connectIn &&
          "before:absolute before:top-1/2 before:-left-[calc(var(--half-gap)+2px)] before:h-0.5 before:w-(--half-gap) before:bg-ink/20",
      )}
    >
      <div className="flex items-center gap-2 rounded-t-md border-b border-ink/15 bg-parchment px-2.5 py-1.5 text-[10px] font-bold text-ink/50">
        <span className="truncate">
          Laga {String(match.matchNumber).padStart(2, "0")}
          {roomName ? ` · ${roomName}` : ""}
        </span>
        {match.scheduledAt && (
          <span className="flex shrink-0 items-center gap-0.5">
            <Clock3Icon className="size-3" aria-hidden />
            {timeFormat.format(new Date(match.scheduledAt))}
          </span>
        )}
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide uppercase",
            badge.className,
          )}
        >
          {badge.dot && <span className="size-1.5 animate-pulse rounded-full bg-gold" />}
          {badge.label}
        </span>
      </div>
      <ParticipantRow
        participant={a}
        seed={a ? seeds?.get(a.id) : undefined}
        score={display(match.participantAId, match.scoreA)}
        placeholder={slotLabels?.a}
        isLeading={leader === "a"}
        isWinner={!!match.winnerId && match.winnerId === match.participantAId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantAId}
      />
      <ParticipantRow
        participant={b}
        seed={b ? seeds?.get(b.id) : undefined}
        score={display(match.participantBId, match.scoreB)}
        placeholder={slotLabels?.b}
        isLeading={leader === "b"}
        isWinner={!!match.winnerId && match.winnerId === match.participantBId}
        isLoser={!!match.winnerId && match.winnerId !== match.participantBId}
        className={cn("border-t border-ink/10", !winTypeLabel && "rounded-b-md")}
      />
      {winTypeLabel && (
        <div className="rounded-b-md border-t border-ink/10 bg-ink px-2.5 py-1 text-[10px] font-semibold text-gold">
          {winTypeLabel} · <span className="font-display">+{points}</span> poin
        </div>
      )}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

function ParticipantRow({
  participant,
  seed,
  score,
  placeholder = { text: "Menunggu pemenang", live: false },
  isWinner,
  isLoser,
  isLeading,
  className,
}: {
  participant?: Participant;
  seed?: number;
  score: number | string | null;
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
        className={cn("flex h-11 items-center gap-2 px-2.5", className)}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-ink/6 text-[10px] font-bold text-ink/40">—</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-ink/80">Menunggu pemenang</span>
          <span className="block truncate text-[9px] text-ink/45">{placeholder.text}</span>
        </span>
        {placeholder.live ? (
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-crimson" aria-label="sedang bertanding" />
        ) : (
          <span className="w-5 text-right text-ink/25">—</span>
        )}
      </div>
    );
  }

  return (
    <div
      data-pid={participant.id}
      title={[participant.name, participant.teamOrClub].filter(Boolean).join(" · ")}
      className={cn("flex h-11 items-center gap-2 px-2.5 transition-colors", isWinner && "bg-gold-soft", className)}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded text-[9px] font-bold",
          isWinner ? "bg-crimson text-white" : "bg-ink/6 text-ink/50",
        )}
      >
        {seed ?? initials(participant.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[11px] font-bold", isLoser ? "text-ink/55" : "text-ink")}>{participant.name}</span>
        <span className="block truncate text-[9px] text-ink/45">{participant.teamOrClub ?? "—"}</span>
      </span>
      {isWinner && <CheckIcon className="size-3.5 shrink-0 text-crimson" aria-label="pemenang" />}
      <span
        className={cn(
          "w-6 text-right font-display text-sm tabular-nums",
          score === null || isLoser ? "text-ink/30" : "text-ink",
          isLeading && "text-crimson",
        )}
      >
        {score ?? "—"}
      </span>
    </div>
  );
}
