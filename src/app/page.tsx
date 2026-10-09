import { ChevronDownIcon } from "lucide-react";

import { BracketTree } from "@/components/bracket/bracket-tree";
import { MatchCard } from "@/components/bracket/match-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getBracket, isFinalStage, PLAYOFF_ROUND } from "@/lib/bracket";
import type { Match, MatchStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function overallStatus(matches: Match[]): MatchStatus {
  if (matches.every((m) => m.status === "done")) return "done";
  if (matches.some((m) => m.status !== "scheduled")) return "ongoing";
  return "scheduled";
}

const STATUS_BADGE: Record<MatchStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  done: { label: "Selesai", variant: "secondary" },
  ongoing: { label: "Berlangsung", variant: "default" },
  scheduled: { label: "Terjadwal", variant: "outline" },
};

export default async function BracketPage() {
  const { sessions, rooms, participants, matches, updatedAt } = await getBracket();

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const roomMatches = matches.filter((m) => !isFinalStage(m));
  const finalMatches = matches.filter(isFinalStage);
  const playoffMatches = finalMatches.filter((m) => m.round === PLAYOFF_ROUND);
  const mainFinalMatches = finalMatches.filter((m) => m.round > PLAYOFF_ROUND);

  const stats = [
    { label: "Peserta", value: participants.length },
    { label: "Total laga", value: matches.length },
    { label: "Selesai", value: matches.filter((m) => m.status === "done").length },
    { label: "Berlangsung", value: matches.filter((m) => m.status === "ongoing").length },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Bracket LRP 2026
            </h1>
            <p className="text-sm text-muted-foreground">
              {participants.length} peserta · {sessions.length} sesi · {rooms.length} ruangan ·
              1 vs 1 eliminasi langsung · 7 menit + 3 menit injury time
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Diperbarui {dateTimeFormat.format(new Date(updatedAt))} WIB
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} size="sm">
              <CardContent>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl font-semibold tabular-nums">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Babak Ruangan</h2>
          <p className="text-sm text-muted-foreground">
            Tiap ruangan di tiap sesi berisi 16 peserta. Juara ruangan maju ke babak final.
          </p>
        </div>
        {sessions.map((session) => {
          const sessionMatches = roomMatches.filter((m) => m.sessionId === session.id);
          const status = overallStatus(sessionMatches);
          const badge = STATUS_BADGE[status];
          return (
            <details
              key={session.id}
              open={status === "ongoing"}
              className="group rounded-xl border bg-card"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <ChevronDownIcon className="size-4 -rotate-90 transition-transform group-open:rotate-0" />
                <span className="font-medium">{session.name}</span>
                {session.startTime && (
                  <span className="text-xs text-muted-foreground">
                    {dateTimeFormat.format(new Date(session.startTime))} WIB
                  </span>
                )}
                <Badge variant={badge.variant} className="ml-auto">
                  {badge.label}
                </Badge>
              </summary>
              <div className="flex flex-col gap-6 border-t px-4 py-4">
                {rooms.map((room) => {
                  const list = sessionMatches.filter((m) => m.roomId === room.id);
                  if (list.length === 0) return null;
                  return (
                    <div key={room.id} className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold">{room.name}</h3>
                        {room.location && (
                          <span className="text-xs text-muted-foreground">{room.location}</span>
                        )}
                      </div>
                      <BracketTree matches={list} participants={participantMap} />
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-lg font-semibold">Babak Final</h2>
          <Badge variant={STATUS_BADGE[overallStatus(finalMatches)].variant}>
            {STATUS_BADGE[overallStatus(finalMatches)].label}
          </Badge>
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">
          40 juara ruangan: 24 unggulan langsung ke 32 besar, 16 lainnya bertanding di play-off
          untuk memperebutkan 8 tempat tersisa.
        </p>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Play-off</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {playoffMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                participants={participantMap}
                roomName={roomMap.get(match.roomId)?.name}
              />
            ))}
          </div>
        </div>

        <BracketTree matches={mainFinalMatches} participants={participantMap} rooms={roomMap} />
      </section>
    </main>
  );
}
