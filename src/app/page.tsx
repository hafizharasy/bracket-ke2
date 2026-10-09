import { ChevronDownIcon } from "lucide-react";
import { Suspense } from "react";

import { BracketFilter } from "@/components/bracket/bracket-filter";
import { BracketTree } from "@/components/bracket/bracket-tree";
import { MatchCard } from "@/components/bracket/match-card";
import { MatchDetails } from "@/components/bracket/match-details";
import { PathHighlight } from "@/components/bracket/path-highlight";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildSlotLabels,
  getBracket,
  isFinalStage,
  PLAYOFF_ROUND,
  roundLabel,
} from "@/lib/bracket";
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

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function BracketPage({ searchParams }: PageProps<"/">) {
  // Filter dibaca dari searchParams (data saat request), jadi bagan dirender
  // di dalam Suspense.
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Bracket LRP 2026
        </h1>
        <p className="text-sm text-muted-foreground">
          1 vs 1 eliminasi langsung · 7 menit + 3 menit injury time
        </p>
      </div>
      <Suspense fallback={<BracketSkeleton />}>
        <BracketView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BracketView({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [data, query] = await Promise.all([getBracket(), searchParams]);
  const { sessions, rooms, participants, matches, updatedAt } = data;

  // Filter dari URL; nilai yang tidak dikenal diabaikan.
  const sesi = pickParam(query.sesi);
  const ruangan = pickParam(query.ruangan);
  const filter = {
    sessionId: sessions.some((s) => s.id === sesi) ? sesi! : null,
    roomId: rooms.some((r) => r.id === ruangan) ? ruangan! : null,
  };
  const isFiltered = !!(filter.sessionId || filter.roomId);
  const inScope = (item: { sessionId: string | null; roomId: string | null }) =>
    (!filter.sessionId || item.sessionId === filter.sessionId) &&
    (!filter.roomId || item.roomId === filter.roomId);
  const visibleSessions = sessions.filter((s) => !filter.sessionId || s.id === filter.sessionId);
  const visibleRooms = rooms.filter((r) => !filter.roomId || r.id === filter.roomId);
  const scopedMatches = matches.filter(inScope);

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const slotLabels = buildSlotLabels(matches);

  const roomMatches = matches.filter((m) => !isFinalStage(m));
  const finalMatches = matches.filter(isFinalStage);
  // Babak final tampil utuh kecuali difilter: per sesi → hanya bila laganya di sesi itu;
  // per ruangan → daftar laga final di ruangan itu (bagan utuh tidak bisa dipotong).
  const scopedFinalMatches = finalMatches.filter(inScope);
  const playoffMatches = finalMatches.filter((m) => m.round === PLAYOFF_ROUND);
  const mainFinalMatches = finalMatches.filter((m) => m.round > PLAYOFF_ROUND);

  const stats = [
    { label: "Peserta", value: participants.filter(inScope).length },
    { label: "Total laga", value: scopedMatches.length },
    { label: "Selesai", value: scopedMatches.filter((m) => m.status === "done").length },
    { label: "Berlangsung", value: scopedMatches.filter((m) => m.status === "ongoing").length },
  ];

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="-mt-6 flex flex-wrap items-end justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {participants.length} peserta · {sessions.length} sesi · {rooms.length} ruangan
          </p>
          <p className="text-xs">Diperbarui {dateTimeFormat.format(new Date(updatedAt))} WIB</p>
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
        <BracketFilter sessions={sessions} rooms={rooms} value={filter} />
      </header>

      <MatchDetails data={data}>
        <PathHighlight>
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Babak Ruangan</h2>
              <p className="text-sm text-muted-foreground">
                Tiap ruangan di tiap sesi berisi 16 peserta. Juara ruangan maju ke babak final.
                Arahkan kursor ke nama peserta untuk menyorot jalurnya; klik kartu untuk melihat detail laga.
              </p>
            </div>
            {visibleSessions.map((session) => {
              const sessionMatches = roomMatches.filter(
                (m) => m.sessionId === session.id && inScope(m),
              );
              const status = overallStatus(sessionMatches);
              const badge = STATUS_BADGE[status];
              return (
                <details
                  key={session.id}
                  open={isFiltered || status === "ongoing"}
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
                    {visibleRooms.map((room) => {
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
                          <BracketTree matches={list} participants={participantMap} slotLabels={slotLabels} />
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </section>

          {scopedFinalMatches.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-heading text-lg font-semibold">Babak Final</h2>
                <Badge variant={STATUS_BADGE[overallStatus(scopedFinalMatches)].variant}>
                  {STATUS_BADGE[overallStatus(scopedFinalMatches)].label}
                </Badge>
              </div>

              {filter.roomId ? (
                <>
                  <p className="-mt-2 text-sm text-muted-foreground">
                    Laga babak final yang dimainkan di {roomMap.get(filter.roomId)?.name}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {scopedFinalMatches.map((match) => (
                      <div key={match.id} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {roundLabel(match.round)}
                        </span>
                        <MatchCard
                          match={match}
                          participants={participantMap}
                          roomName={roomMap.get(match.roomId)?.name}
                          slotLabels={slotLabels.get(match.id)}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="-mt-2 text-sm text-muted-foreground">
                    40 juara ruangan: 24 unggulan langsung ke 32 besar, 16 lainnya bertanding di
                    play-off untuk memperebutkan 8 tempat tersisa.
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
                          slotLabels={slotLabels.get(match.id)}
                        />
                      ))}
                    </div>
                  </div>

                  <BracketTree
                    matches={mainFinalMatches}
                    participants={participantMap}
                    rooms={roomMap}
                    slotLabels={slotLabels}
                  />
                </>
              )}
            </section>
          )}
        </PathHighlight>
      </MatchDetails>
    </>
  );
}

function BracketSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Memuat bagan">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-muted" />
      <div className="h-96 rounded-xl bg-muted" />
    </div>
  );
}
