"use client";

import { CheckIcon, HourglassIcon } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { buildSlotLabels, FINAL_ROUND, roundLabel, SEMIFINAL_ROUND, type SlotLabel } from "@/lib/bracket";
import { formatPoints, winPoints } from "@/lib/final-standings";
import type { BracketData, Match, MatchStatus, Participant, Room, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<MatchStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  done: { label: "Selesai", variant: "secondary" },
  ongoing: { label: "Berlangsung", variant: "default" },
  scheduled: { label: "Terjadwal", variant: "outline" },
};

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/**
 * Membuka modal detail saat kartu pertandingan (elemen ber-`data-match-id`)
 * diklik atau ditekan Enter/Spasi. Kartu tetap server component; klik
 * ditangkap lewat event delegation di pembungkus ini.
 */
export function MatchDetails({ data, children }: { data: BracketData; children: ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const lookup = useMemo(
    () => ({
      matches: new Map(data.matches.map((m) => [m.id, m])),
      participants: new Map(data.participants.map((p) => [p.id, p])),
      rooms: new Map(data.rooms.map((r) => [r.id, r])),
      sessions: new Map(data.sessions.map((s) => [s.id, s])),
      slotLabels: buildSlotLabels(data.matches, {
        sessions: new Map(data.sessions.map((s) => [s.id, s])),
        rooms: new Map(data.rooms.map((r) => [r.id, r])),
      }),
    }),
    [data],
  );

  function openFrom(target: EventTarget) {
    const card = (target as HTMLElement).closest<HTMLElement>("[data-match-id]");
    if (!card) return false;
    triggerRef.current = card;
    setMatchId(card.dataset.matchId!);
    return true;
  }

  const match = matchId ? lookup.matches.get(matchId) : undefined;

  return (
    <div
      className="contents"
      onClick={(e) => openFrom(e.target)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && openFrom(e.target)) e.preventDefault();
      }}
    >
      {children}
      <Dialog open={!!match} onOpenChange={(open) => !open && setMatchId(null)}>
        <DialogContent finalFocus={triggerRef} className="sm:max-w-md">
          {match && <MatchDetailBody match={match} lookup={lookup} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Lookup = {
  matches: Map<string, Match>;
  participants: Map<string, Participant>;
  rooms: Map<string, Room>;
  sessions: Map<string, Session>;
  slotLabels: ReturnType<typeof buildSlotLabels>;
};

function MatchDetailBody({ match, lookup }: { match: Match; lookup: Lookup }) {
  const room = lookup.rooms.get(match.roomId);
  const session = lookup.sessions.get(match.sessionId);
  const labels = lookup.slotLabels.get(match.id);
  const status = STATUS[match.status];
  const next = match.nextMatchId ? lookup.matches.get(match.nextMatchId) : undefined;

  const side = (id: string | null, score: number | null, label?: SlotLabel) => ({
    participant: id ? lookup.participants.get(id) : undefined,
    score,
    label,
    isWinner: !!match.winnerId && match.winnerId === id,
  });

  let advance: string;
  if (next) {
    const nextRoom = lookup.rooms.get(next.roomId);
    advance = `${roundLabel(next.round)} #${next.matchNumber}${nextRoom ? ` · ${nextRoom.name}` : ""}`;
  } else if (match.round === SEMIFINAL_ROUND) {
    advance = "Final (kompetisi penuh antar finalis)";
  } else if (match.round === FINAL_ROUND) {
    advance = match.winType
      ? `+${formatPoints(winPoints(match.winType))} poin klasemen final`
      : "Poin klasemen final";
  } else {
    advance = "—";
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle>
            {roundLabel(match.round)} · Laga #{match.matchNumber}
          </DialogTitle>
          <Badge variant={status.variant} className={cn(match.status === "ongoing" && "bg-red-600")}>
            {status.label}
          </Badge>
        </div>
        <DialogDescription>
          {[session?.name, room?.name].filter(Boolean).join(" · ")}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <Contender {...side(match.participantAId, match.scoreA, labels?.a)} />
        <div className="self-center text-xs font-semibold text-muted-foreground">VS</div>
        <Contender {...side(match.participantBId, match.scoreB, labels?.b)} />
      </div>

      <Separator />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Sesi</dt>
        <dd>{session?.name ?? "–"}</dd>
        <dt className="text-muted-foreground">Ruangan</dt>
        <dd>
          {room?.name ?? "–"}
          {room?.location && <span className="text-muted-foreground"> · {room.location}</span>}
        </dd>
        <dt className="text-muted-foreground">Jadwal</dt>
        <dd>{match.scheduledAt ? `${dateTimeFormat.format(new Date(match.scheduledAt))} WIB` : "–"}</dd>
        <dt className="text-muted-foreground">Format</dt>
        <dd>
          {match.round === SEMIFINAL_ROUND
            ? "Best of 3 (menang 2 game)"
            : match.round === FINAL_ROUND
              ? "Kompetisi penuh — A tuan rumah (jalan pertama)"
              : "7 menit + 3 menit injury time"}
        </dd>
        <dt className="text-muted-foreground">Pemenang maju ke</dt>
        <dd>{advance}</dd>
      </dl>
    </>
  );
}

function Contender({
  participant,
  score,
  label,
  isWinner,
}: {
  participant?: Participant;
  score: number | null;
  label?: SlotLabel;
  isWinner: boolean;
}) {
  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
        <HourglassIcon className="size-4" aria-hidden />
        <span className="italic">{label?.text ?? "Menunggu pemenang"}</span>
        {label?.live && <span className="text-red-600 dark:text-red-400">sedang bertanding</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
        isWinner && "border-emerald-500/60 bg-emerald-500/10",
      )}
    >
      <span className="text-3xl font-bold tabular-nums">{score ?? "–"}</span>
      <span className="font-medium leading-tight">{participant.name}</span>
      <span className="text-xs text-muted-foreground">
        {participant.teamOrClub ?? "Tanpa sekolah"} · {participant.id.toUpperCase()}
      </span>
      {isWinner && (
        <Badge className="mt-1 bg-emerald-600 text-white">
          <CheckIcon data-icon="inline-start" />
          Pemenang
        </Badge>
      )}
    </div>
  );
}
