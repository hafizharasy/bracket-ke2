import { ArrowRightIcon, CalendarDaysIcon, MapPinIcon, ShieldCheckIcon, SparklesIcon, TrophyIcon, UsersIcon, ZapIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SectionBadge } from "@/components/arena/arena-chrome";
import { CountUp } from "@/components/arena/arena-client";
import { FINAL_ROUND, hasScore, isFinalSession, LAST_ROOM_ROUND, roomSessions, roundLabel } from "@/lib/bracket";
import { finalistsOf, finalStandings, formatPoints, winPoints, type StandingRow } from "@/lib/final-standings";
import type { BracketData, Match, Participant, Session } from "@/lib/types";
import { cn } from "@/lib/utils";


/**
 * Laga yang sedang dimainkan: semua meja bermain serentak, jadi yang tampil
 * adalah semua laga belum selesai (peserta lengkap) di babak berjalan tiap
 * ruangan, untuk sesi terawal yang masih punya laga. Setelah babak ruangan
 * habis: laga semifinal/final yang belum selesai.
 */
export function liveMatchGroups(data: BracketData) {
  const ready = data.matches.filter((m) => m.status !== "done" && m.participantAId && m.participantBId);
  if (ready.length === 0) return null;
  const order = new Map(data.sessions.map((s, i) => [s.id, s.orderIndex ?? i]));
  const roomReady = ready.filter((m) => m.round <= LAST_ROOM_ROUND);
  let scope = ready;
  // Babak ruangan sudah habis → sesi Semifinal & Final (bila ada).
  let session: Session | undefined = data.sessions.find(isFinalSession);
  if (roomReady.length > 0) {
    const first = roomReady.reduce((a, b) => ((order.get(b.sessionId) ?? 0) < (order.get(a.sessionId) ?? 0) ? b : a));
    session = data.sessions.find((s) => s.id === first.sessionId);
    scope = roomReady.filter((m) => m.sessionId === first.sessionId);
  }
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  // (Tanpa Map.groupBy: belum ada di HP lama.)
  const byRoom = new Map<string, Match[]>();
  for (const m of scope) byRoom.set(m.roomId, [...(byRoom.get(m.roomId) ?? []), m]);
  const groups = [...byRoom.entries()]
    .map(([roomId, list]) => {
      const round = Math.min(...list.map((m) => m.round));
      return {
        roomId,
        roomName: roomName.get(roomId) ?? roomId,
        round,
        matches: list.filter((m) => m.round === round).sort((a, b) => a.matchNumber - b.matchNumber),
      };
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName, "id", { numeric: true }));
  // Sudah ada laga selesai (atau berjalan) di cakupan ini → sedang berlangsung; belum → akan dimulai.
  const stageMatch = (m: Match) => (roomReady.length > 0 ? m.sessionId === session?.id && m.round <= LAST_ROOM_ROUND : m.round > LAST_ROOM_ROUND);
  const started = data.matches.some((m) => m.status !== "scheduled" && stageMatch(m));
  return { session, groups, total: groups.reduce((n, g) => n + g.matches.length, 0), started };
}

/** Hasil terakhir (bila tidak ada laga yang sedang dimainkan). */
function lastResult(matches: Match[]) {
  return matches
    .filter((m) => m.status === "done")
    .sort((a, b) => b.round - a.round || (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""))[0];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const FLAG_COLORS = ["bg-crimson", "bg-gold", "bg-sky"];

/** Untaian bendera segitiga di atas hero. */
function Bunting({ count = 14 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-2 h-12">
      <div className="absolute inset-x-0 top-1 h-0.5 -rotate-[0.6deg] bg-navy/70" />
      <div className="absolute inset-x-0 top-1 flex justify-around px-2">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn("arena-flag block h-9 w-7 [clip-path:polygon(0_0,100%_0,50%_100%)] sm:h-10 sm:w-8", FLAG_COLORS[i % 3], i > 7 && "hidden sm:block")}
            style={{ animationDelay: `${(i % 5) * -0.6}s`, animationDuration: `${2.8 + (i % 4) * 0.4}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span aria-hidden className={cn("arena-cloud pointer-events-none absolute block h-8 w-20 [.arena[data-theme=night]_&]:opacity-25", className)} style={style}>
      <span className="absolute bottom-0 left-0 h-5 w-20 rounded-full bg-white/90" />
      <span className="absolute bottom-2 left-4 size-9 rounded-full bg-white/90" />
      <span className="absolute bottom-1 left-10 size-7 rounded-full bg-white/90" />
    </span>
  );
}

export function ArenaHero({ data, live }: { data: BracketData; live: ReactNode }) {
  const liveGroups = liveMatchGroups(data);
  const last = liveGroups ? undefined : lastResult(data.matches);
  const people = new Map(data.participants.map((p) => [p.id, p]));
  // Semua laga final selesai → tampilkan juara 1–3 & harapan 1–2 dari klasemen poin.
  const finals = data.matches.filter((m) => m.round === FINAL_ROUND);
  const finalDone = finals.length > 0 && finals.every((m) => m.status === "done");
  const podium = finalDone
    ? finalStandings(finals, finalistsOf(data.matches).filter((id): id is string => !!id)).slice(0, 5)
    : null;

  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--sky-top),var(--sky-bottom))]">
      {/* Foto bianglala di kanan, memudar ke langit di kiri. */}
      <div
        aria-hidden
        className="arena-parallax absolute inset-y-0 right-0 -z-10 w-full bg-cover bg-[position:70%_30%] opacity-35 lg:opacity-90 [mask-image:linear-gradient(90deg,transparent_5%,black_55%)] lg:w-[62%] [.arena[data-theme=night]_&]:opacity-25 [.arena[data-theme=night]_&]:mix-blend-luminosity"
        style={{ backgroundImage: "url(/arena/carnival-day.jpg)" }}
      />
      <Bunting />
      <span aria-hidden className="arena-sun absolute top-24 left-[46%] -z-10 hidden size-20 rounded-full bg-[#ffe27a] lg:block" />
      <Cloud className="top-28 left-[38%] -z-10 hidden lg:block" />
      <Cloud className="top-52 left-[3%] -z-10 scale-75" style={{ animationDuration: "46s" }} />
      <span aria-hidden className="arena-float absolute top-40 left-[6%] size-2.5 rotate-45 bg-gold" />
      <span aria-hidden className="arena-float absolute top-[70%] left-[48%] size-2 rotate-45 bg-[#fffaf0] [animation-delay:-2s]" />
      <span aria-hidden className="arena-float absolute top-56 right-[5%] size-2 rounded-full bg-crimson [animation-delay:-1s]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-20 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24 lg:pb-24">
        <div className="flex flex-col items-start gap-5">
          <span className="arena-enter" style={{ ["--d" as string]: 0 }}>
            <SectionBadge tone="red">
              <SparklesIcon className="size-3.5" aria-hidden /> Outdoor carnival · UNESA 2026
            </SectionBadge>
          </span>
          <h1 className="font-display text-[2.6rem] leading-[1.02] sm:text-6xl">
            <span className="arena-title-1 arena-enter block" style={{ ["--d" as string]: 1 }}>
              Satu panggung.
            </span>
            <span className="arena-title-2 arena-enter block" style={{ ["--d" as string]: 2 }}>
              Ratusan penantang.
            </span>
          </h1>
          <p className="arena-enter max-w-xl text-base leading-relaxed text-ink/80" style={{ ["--d" as string]: 3 }}>
            Pantau setiap langkah menuju gelar juara Lomba Rancang Permainan 2026—langsung, jelas, dan tanpa melewatkan satu
            laga pun.
          </p>
          <div className="arena-enter flex flex-wrap items-center gap-4" style={{ ["--d" as string]: 4 }}>
            <a
              href="#bracket"
              className="group flex items-center gap-2 rounded-full bg-crimson px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_var(--color-gold)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-gold)]"
            >
              Masuk arena <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </a>
            {live}
          </div>
          <p className="arena-enter text-[10px] text-ink/50" style={{ ["--d" as string]: 5 }}>
            Foto karnaval: Pascale Amez · Unsplash
          </p>
        </div>

        <div className="arena-pop" style={{ ["--d" as string]: 3 }}>
          {podium && podium.length > 0 ? (
            <WinnersCard rows={podium} people={people} />
          ) : (
            liveGroups ? (
              <LiveMatchesCard {...liveGroups} people={people} />
            ) : (
              last && <SpotlightCard match={last} kind="last" data={data} people={people} />
            )
          )}
        </div>
      </div>
      <div aria-hidden className="arena-grass absolute inset-x-0 bottom-0" />
    </section>
  );
}

/** Bingkai kartu sorotan: tepi emas, garis merah, panji bergerigi dengan lampu. */
function MarqueeFrame({ href, children }: { href?: string; children: ReactNode }) {
  const Frame = href ? "a" : "div";
  return (
    <Frame
      href={href}
      className={cn(
        "group relative block rounded-3xl bg-gold p-2 shadow-[8px_8px_0_0_rgb(26_26_46/0.25)] transition-transform duration-300",
        href && "hover:-translate-y-1 hover:rotate-[-0.4deg]",
      )}
    >
      <div className="overflow-hidden rounded-[1.25rem] border-4 border-crimson bg-paper">
        <div aria-hidden className="arena-pennant relative h-9 bg-crimson">
          <div className="arena-bulbs absolute inset-x-2 top-2 h-3" />
        </div>
        {children}
      </div>
    </Frame>
  );
}

function SpotlightCard({
  match,
  kind,
  data,
  people,
}: {
  match: Match;
  kind: "last";
  data: BracketData;
  people: Map<string, Participant>;
}) {
  const room = data.rooms.find((r) => r.id === match.roomId);
  // Final: poin dari jenis kemenangan; semifinal: skor game; babak ruangan
  // (best of one): tanpa skor, cukup tanda menang.
  const shown = (id: string | null, score: number | null) =>
    match.round === FINAL_ROUND && match.winnerId
      ? id === match.winnerId
        ? `+${formatPoints(winPoints(match.winType))}`
        : "0"
      : hasScore(match.round)
        ? score
        : undefined;
  const sides = [
    { p: match.participantAId ? people.get(match.participantAId) : undefined, score: shown(match.participantAId, match.scoreA), avatar: "bg-navy text-white" },
    { p: match.participantBId ? people.get(match.participantBId) : undefined, score: shown(match.participantBId, match.scoreB), avatar: "bg-gold text-navy" },
  ];
  const heading = kind === "last" ? "Hasil terakhir" : "";

  return (
    <MarqueeFrame href={`#${match.id}`}>
        <div className="flex flex-col gap-4 p-5 text-ink sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-block border-b-2 border-ink/20 pb-1 text-[10px] font-bold tracking-[0.15em] text-ink/60 uppercase">
                {heading}
              </div>
              <div className="mt-2 font-display text-xl text-crimson [.arena[data-theme=night]_&]:text-gold">{roundLabel(match.round)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-b border-ink/15 pb-4 text-xs text-ink/60">
            {room && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden /> {room.name}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {sides.map(({ p, score, avatar }, i) => (
              <div key={i}>
                {i === 1 && (
                  <div className="relative my-1 flex items-center justify-center" aria-hidden>
                    <span className="absolute inset-x-0 border-t border-dashed border-ink/25" />
                    <span className="relative bg-paper px-2 font-display text-[9px] text-crimson">vs</span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-ink/10 bg-paper-2 p-3",
                    match.winnerId && p?.id === match.winnerId && "border-gold bg-gold-soft",
                  )}
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg font-display text-xs", avatar)}>
                    {p ? initials(p.name) : "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{p?.name ?? "Menunggu pemenang"}</span>
                    <span className="block truncate text-[11px] text-ink/55">{p?.teamOrClub ?? "—"}</span>
                  </span>
                  {score !== undefined ? (
                    <span className="font-display text-2xl text-crimson tabular-nums">{score ?? "—"}</span>
                  ) : (
                    match.winnerId &&
                    p?.id === match.winnerId && (
                      <span className="rounded bg-crimson px-2 py-1 font-display text-[10px] text-white uppercase">Menang</span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink/55">
            <ShieldCheckIcon className="size-3.5" aria-hidden /> Hasil diverifikasi pengawas ruangan
          </div>
        </div>
    </MarqueeFrame>
  );
}

/** Semua laga yang sedang dimainkan, per ruangan; ketuk satu laga untuk detailnya. */
function LiveMatchesCard({
  session,
  groups,
  total,
  started,
  people,
}: NonNullable<ReturnType<typeof liveMatchGroups>> & { people: Map<string, Participant> }) {
  const name = (id: string | null) => (id ? people.get(id)?.name : undefined) ?? "?";
  return (
    <MarqueeFrame>
      <div className="flex flex-col gap-4 p-5 text-ink sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-block border-b-2 border-ink/20 pb-1 text-[10px] font-bold tracking-[0.15em] text-ink/60 uppercase">
              {started ? "Sedang berlangsung" : "Akan dimulai"}
            </div>
            <div className="mt-2 font-display text-xl text-crimson [.arena[data-theme=night]_&]:text-gold">
              {session?.name ?? roundLabel(groups[0].round)}
            </div>
            <div className="mt-1 text-xs text-ink/60">
              {groups.length} ruangan · {total} laga belum selesai
            </div>
          </div>
          {started && (
            <span className="flex items-center gap-1 rounded bg-crimson px-2 py-1 font-display text-[10px] text-white">
              <ZapIcon className="size-3 fill-white" aria-hidden /> Live
            </span>
          )}
        </div>
        <div className="-mx-1 flex max-h-[22rem] flex-col gap-4 overflow-y-auto px-1 [scrollbar-width:thin]">
          {groups.map((g) => (
            <div key={g.roomId} className="flex flex-col gap-1.5">
              <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-paper py-1 text-[11px] font-bold text-ink/70">
                <MapPinIcon className="size-3.5 text-crimson" aria-hidden />
                {g.roomName} · {roundLabel(g.round)}
                <span className="ml-auto font-normal text-ink/50">{g.matches.length} laga</span>
              </div>
              {g.matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-match-id={m.id}
                  aria-haspopup="dialog"
                  className="flex items-center gap-2 rounded-lg border border-ink/10 bg-paper-2 px-2.5 py-2 text-left text-xs transition-colors hover:border-gold hover:bg-gold-soft"
                >
                  <span className="w-7 shrink-0 font-display text-[10px] text-crimson tabular-nums">
                    #{String(m.matchNumber).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{name(m.participantAId)}</span>
                  <span className="shrink-0 font-display text-[9px] text-crimson">vs</span>
                  <span className="min-w-0 flex-1 truncate text-right font-semibold">{name(m.participantBId)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink/55">
          <ShieldCheckIcon className="size-3.5" aria-hidden /> Ketuk laga untuk detail · hasil diverifikasi pengawas ruangan
        </div>
      </div>
    </MarqueeFrame>
  );
}

const PLACES = [
  { label: "Juara 1", medal: "bg-gold text-navy", row: "border-gold bg-gold-soft" },
  { label: "Juara 2", medal: "bg-[#cfd6e0] text-navy", row: "border-ink/10 bg-paper-2" },
  { label: "Juara 3", medal: "bg-[#d99a5b] text-white", row: "border-ink/10 bg-paper-2" },
  { label: "Harapan 1", medal: "bg-navy text-gold", row: "border-ink/10 bg-paper-2" },
  { label: "Harapan 2", medal: "bg-navy text-gold", row: "border-ink/10 bg-paper-2" },
];

/** Kartu juara setelah final selesai: juara 1–3 dan harapan 1–2 sesuai urutan klasemen poin. */
function WinnersCard({ rows, people }: { rows: StandingRow[]; people: Map<string, Participant> }) {
  const tied = rows.some((r) => r.tied);
  return (
    <MarqueeFrame href="#final">
        <div className="flex flex-col gap-3 p-5 text-ink sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-block border-b-2 border-ink/20 pb-1 text-[10px] font-bold tracking-[0.15em] text-ink/60 uppercase">
                Turnamen selesai
              </div>
              <div className="mt-2 font-display text-xl text-crimson [.arena[data-theme=night]_&]:text-gold">Para juara</div>
            </div>
            <TrophyIcon className="size-8 text-crimson" aria-hidden />
          </div>
          <ol className="flex flex-col gap-2">
            {rows.map((row, i) => {
              const p = people.get(row.participantId);
              const place = PLACES[i];
              return (
                <li key={row.participantId} className={cn("flex items-center gap-3 rounded-xl border p-2.5", place.row, i === 0 && "py-3.5")}>
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-lg font-display",
                      i === 0 ? "size-12 text-2xl" : "size-10 text-lg",
                      place.medal,
                    )}
                    aria-hidden
                  >
                    {place.label.split(" ")[1]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-display text-[10px] tracking-wide uppercase", i < 3 ? "text-crimson" : "text-ink/55")}>
                      {place.label}
                    </span>
                    <span className={cn("block truncate font-bold", i === 0 ? "text-base" : "text-sm")}>{p?.name ?? row.participantId}</span>
                    <span className="block truncate text-[11px] text-ink/55">
                      {p?.teamOrClub ?? "—"} · {row.wins} menang
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-right font-display text-crimson tabular-nums", i === 0 ? "text-2xl" : "text-lg")}>
                    {formatPoints(row.points)}
                    <span className="ml-0.5 font-body text-[10px] font-semibold text-ink/45">poin</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-1.5 text-[11px] text-ink/55">
            <ShieldCheckIcon className="size-3.5" aria-hidden />
            {tied ? "Ada poin yang masih seri — urutan akhir ditetapkan panitia." : "Urutan sesuai klasemen poin final."}
          </div>
        </div>
    </MarqueeFrame>
  );
}

export function ArenaStats({ data }: { data: BracketData }) {
  const done = data.matches.filter((m) => m.status === "done").length;
  const tiles = [
    { icon: UsersIcon, value: data.participants.length, label: "Peserta terdaftar" },
    { icon: MapPinIcon, value: data.sessionRooms.length, label: "Ruangan aktif" },
    { icon: CalendarDaysIcon, value: roomSessions(data.sessions).length, label: "Sesi babak ruangan" },
    { icon: TrophyIcon, value: done, extra: `/ ${data.matches.length}`, label: "Laga selesai" },
  ];
  return (
    <section aria-label="Ringkasan turnamen" className="arena-tent bg-cream">
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, value, extra, label }, i) => (
          <div
            key={label}
            data-reveal
            style={{ ["--i" as string]: i }}
            className={cn(
              "group flex items-center gap-3 border-ink/10 px-4 py-6 sm:justify-center sm:px-6",
              i % 2 === 0 && "border-r",
              i < 2 && "border-b lg:border-b-0",
              i === 1 && "lg:border-r",
              i === 2 && "lg:border-r",
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-crimson text-white shadow-[2px_2px_0_0_var(--color-navy)] transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-2xl leading-none text-ink">
                <CountUp value={value} />
                {extra && <span className="ml-1 font-body text-xs font-semibold text-ink/40">{extra}</span>}
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-muted-ink">{label}</span>
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden className="arena-ribbon h-3" />
    </section>
  );
}
