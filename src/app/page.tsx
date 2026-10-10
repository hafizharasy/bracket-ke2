import { ChevronDownIcon, CrownIcon } from "lucide-react";
import { Suspense } from "react";

import { ArenaFooter, ArenaHeader, FormatSection, SectionBadge } from "@/components/arena/arena-chrome";
import { ArenaHero, ArenaStats } from "@/components/arena/arena-hero";
import { BracketFilter } from "@/components/bracket/bracket-filter";
import { BracketScroller } from "@/components/bracket/bracket-scroller";
import { BracketTree } from "@/components/bracket/bracket-tree";
import { FinalStandingsTable } from "@/components/bracket/final-standings-table";
import { LiveUpdater } from "@/components/bracket/live-updater";
import { MatchCard } from "@/components/bracket/match-card";
import { MatchDetails } from "@/components/bracket/match-details";
import { PathHighlight } from "@/components/bracket/path-highlight";
import { activeCells, buildSlotLabels, FINAL_ROUND, isFinalStage, roundLabel, roomsInSession, SEMIFINAL_ROUND } from "@/lib/bracket";
import { finalStandings } from "@/lib/final-standings";
import { getBracket } from "@/lib/get-bracket";
import type { Match, MatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

function overallStatus(matches: Match[]): MatchStatus {
  if (matches.length > 0 && matches.every((m) => m.status === "done")) return "done";
  if (matches.some((m) => m.status !== "scheduled")) return "ongoing";
  return "scheduled";
}

const STATUS_PILL: Record<MatchStatus, { label: string; className: string }> = {
  done: { label: "Selesai", className: "bg-gold text-ink" },
  ongoing: { label: "Berlangsung", className: "bg-crimson text-white" },
  scheduled: { label: "Terjadwal", className: "bg-ink/8 text-ink/60" },
};

function StatusPill({ status }: { status: MatchStatus }) {
  const pill = STATUS_PILL[status];
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase", pill.className)}>
      {pill.label}
    </span>
  );
}

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function BracketPage({ searchParams }: PageProps<"/">) {
  // Filter dibaca dari searchParams (data saat request), jadi bagan dirender
  // di dalam Suspense.
  return (
    <div className="arena flex min-h-full flex-1 flex-col">
      <ArenaHeader />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<BracketSkeleton />}>
          <BracketView searchParams={searchParams} />
        </Suspense>
      </main>
      <FormatSection />
      <ArenaFooter />
    </div>
  );
}

async function BracketView({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = await searchParams;
  const data = await getBracket();
  const { sessions, rooms, participants, matches, version, updatedAt } = data;

  // Filter dari URL; nilai yang tidak dikenal diabaikan.
  const sesi = pickParam(query.sesi);
  const ruangan = pickParam(query.ruangan);
  const filter = {
    sessionId: sessions.some((s) => s.id === sesi) ? sesi! : null,
    roomId: rooms.some((r) => r.id === ruangan) ? ruangan! : null,
  };
  const isFiltered = !!(filter.sessionId || filter.roomId);
  const inScope = (item: { sessionId: string | null; roomId: string | null }) =>
    (!filter.sessionId || item.sessionId === filter.sessionId) && (!filter.roomId || item.roomId === filter.roomId);

  const cells = activeCells(data).filter((c) => inScope({ sessionId: c.session.id, roomId: c.room.id }));
  const visibleSessions = sessions.filter((s) => cells.some((c) => c.session.id === s.id));
  const selectableRooms = filter.sessionId
    ? roomsInSession(data, filter.sessionId)
    : rooms.filter((r) => data.sessionRooms.some((c) => c.roomId === r.id)).sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const slotLabels = buildSlotLabels(matches, {
    sessions: new Map(sessions.map((s) => [s.id, s])),
    rooms: roomMap,
  });

  const roomMatches = matches.filter((m) => !isFinalStage(m));
  // Nomor undian: urutan peserta di babak 1 ruangannya (laga n → 2n-1 & 2n).
  const seeds = new Map<string, number>();
  for (const m of roomMatches) {
    if (m.round !== 1) continue;
    if (m.participantAId) seeds.set(m.participantAId, m.matchNumber * 2 - 1);
    if (m.participantBId) seeds.set(m.participantBId, m.matchNumber * 2);
  }

  const finalMatches = matches.filter(isFinalStage);
  const scopedFinalMatches = finalMatches.filter(inScope);
  const semifinals = finalMatches.filter((m) => m.round === SEMIFINAL_ROUND).sort((a, b) => a.matchNumber - b.matchNumber);
  const roundRobin = finalMatches.filter((m) => m.round === FINAL_ROUND).sort((a, b) => a.matchNumber - b.matchNumber);
  const finalists = semifinals.map((m) => (m.status === "done" ? m.winnerId : null));
  const standings = finalStandings(roundRobin, finalists.filter((id): id is string => !!id));
  const pendingFinalists = semifinals.filter((m, i) => !finalists[i]).map((m) => m.matchNumber);
  const finalComplete = roundRobin.length > 0 && roundRobin.every((m) => m.status === "done");
  const showFinal = filter.roomId ? scopedFinalMatches.length > 0 : finalMatches.length > 0 && !filter.sessionId;

  return (
    <>
      <ArenaHero data={data} live={<LiveUpdater version={version} updatedAt={updatedAt} tone="dark" />} />
      <ArenaStats data={data} />

      <MatchDetails data={data}>
        <PathHighlight>
          <section id="bracket" className="arena-dots scroll-mt-20">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
              <div className="flex flex-col items-start gap-3">
                <SectionBadge>Jalur menuju juara</SectionBadge>
                <h2 className="font-display text-3xl text-ink sm:text-4xl">Bracket pertandingan</h2>
                <p className="text-sm text-ink/65">
                  Pilih sesi dan ruangan untuk melihat progres pertandingan. Arahkan kursor ke nama peserta untuk menyorot
                  jalurnya; klik kartu untuk detail laga.
                </p>
              </div>
              <BracketFilter sessions={sessions} rooms={selectableRooms} value={filter} />

              {matches.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-ink/20 bg-white/70 p-8 text-center text-sm text-ink/60">
                  Bagan pertandingan belum tersedia. Pantau lagi menjelang hari pertandingan.
                </p>
              ) : cells.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-ink/20 bg-white/70 p-8 text-center text-sm text-ink/60">
                  Tidak ada bagan untuk pilihan ini.
                </p>
              ) : (
                visibleSessions.map((session) => {
                  const sessionCells = cells.filter((c) => c.session.id === session.id);
                  const sessionMatches = roomMatches.filter((m) => m.sessionId === session.id && inScope(m));
                  const status = overallStatus(sessionMatches);
                  const body = (
                    <div className="flex flex-col gap-10">
                      {sessionCells.map(({ room }) => {
                        const list = sessionMatches.filter((m) => m.roomId === room.id);
                        if (list.length === 0) return null;
                        const champion = list.find((m) => m.round === Math.max(...list.map((x) => x.round)))?.winnerId;
                        return (
                          <div key={room.id} className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-gold">
                                <CrownIcon className="size-5 text-crimson" aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <h3 className="text-base font-bold text-ink">{room.name}</h3>
                                <p className="text-xs text-ink/55">
                                  {session.name}
                                  {session.startTime && ` · ${dateFormat.format(new Date(session.startTime))}`}
                                  {room.location && ` · ${room.location}`}
                                </p>
                              </div>
                              <p className="ml-auto text-xs text-ink/55">
                                {list.length} laga · {list.filter((m) => m.round === 1).length * 2} peserta ·{" "}
                                {champion ? (
                                  <span className="font-bold text-crimson">Juara: {participantMap.get(champion)?.name}</span>
                                ) : (
                                  "1 juara"
                                )}
                              </p>
                            </div>
                            <BracketTree
                              matches={list}
                              participants={participantMap}
                              slotLabels={slotLabels}
                              seeds={seeds}
                              label={`Bagan ${session.name} ${room.name}`}
                              tone="cream"
                            />
                          </div>
                        );
                      })}
                    </div>
                  );

                  return isFiltered ? (
                    <div key={session.id}>{body}</div>
                  ) : (
                    <details
                      key={session.id}
                      open={status === "ongoing"}
                      className="group rounded-2xl border-2 border-ink bg-white/80 shadow-[4px_4px_0_0_#e4d6b4] open:bg-white/60"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                        <ChevronDownIcon className="size-4 -rotate-90 text-crimson transition-transform group-open:rotate-0" aria-hidden />
                        <span className="font-display text-base text-ink">{session.name}</span>
                        {session.startTime && (
                          <span className="hidden text-xs text-ink/55 sm:inline">{dateFormat.format(new Date(session.startTime))}</span>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          <span className="hidden text-xs text-ink/55 sm:inline">{sessionCells.length} ruangan</span>
                          <StatusPill status={status} />
                        </span>
                      </summary>
                      <div className="border-t-2 border-ink/10 px-5 py-6">{body}</div>
                    </details>
                  );
                })
              )}
            </div>
          </section>

          {showFinal && (
            <section id="final" className="scroll-mt-20 border-t-4 border-gold bg-[#fff3d6]">
              <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6">
                <div className="flex flex-col items-start gap-3">
                  <SectionBadge>Puncak kompetisi</SectionBadge>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl text-ink sm:text-4xl">Semifinal & Final</h2>
                    <StatusPill status={overallStatus(filter.roomId ? scopedFinalMatches : finalMatches)} />
                  </div>
                </div>

                {filter.roomId ? (
                  <>
                    <p className="-mt-4 text-sm text-ink/65">Laga babak final yang dimainkan di {roomMap.get(filter.roomId)?.name}.</p>
                    <div className="flex flex-wrap gap-4">
                      {scopedFinalMatches.map((match) => (
                        <div key={match.id} className="flex flex-col gap-1.5">
                          <span className="font-display text-xs text-ink uppercase">{roundLabel(match.round)}</span>
                          <MatchCard match={match} participants={participantMap} roomName={roomMap.get(match.roomId)?.name.replace(/^Ruangan /, "R")} slotLabels={slotLabels.get(match.id)} />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="font-display text-lg text-ink uppercase">Semifinal</h3>
                        <p className="text-sm text-ink/65">Juara tiap ruangan bertanding best of 3 — yang lebih dulu menang 2 game lolos ke final.</p>
                      </div>
                      <BracketScroller label="Laga semifinal" tone="background">
                        <div className="flex w-max gap-4 pr-2 pb-2">
                          {semifinals.map((match) => (
                            <div key={match.id} data-round-col className="snap-start">
                              <MatchCard match={match} participants={participantMap} roomName={roomMap.get(match.roomId)?.name.replace(/^Ruangan /, "R")} slotLabels={slotLabels.get(match.id)} />
                            </div>
                          ))}
                        </div>
                      </BracketScroller>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="font-display text-lg text-ink uppercase">Final — kompetisi penuh</h3>
                        <p className="text-sm text-ink/65">
                          Setiap finalis bertemu dua kali: sekali sebagai tuan rumah (jalan pertama) dan sekali sebagai tamu.
                        </p>
                      </div>
                      <FinalStandingsTable rows={standings} participants={participantMap} pending={pendingFinalists} complete={finalComplete} />
                      <BracketScroller label="Laga final" tone="background">
                        <div className="flex w-max gap-4 pr-2 pb-2">
                          {roundRobin.map((match) => (
                            <div key={match.id} data-round-col className="snap-start">
                              <MatchCard match={match} participants={participantMap} roomName={roomMap.get(match.roomId)?.name.replace(/^Ruangan /, "R")} slotLabels={slotLabels.get(match.id)} />
                            </div>
                          ))}
                        </div>
                      </BracketScroller>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </PathHighlight>
      </MatchDetails>
    </>
  );
}

function BracketSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat bagan">
      <div className="h-[28rem] animate-pulse bg-ink" />
      <div className="mx-auto flex max-w-6xl animate-pulse flex-col gap-4 px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 rounded-xl bg-parchment" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-parchment" />
      </div>
    </div>
  );
}
