import { ArrowRightIcon, CalendarDaysIcon, Clock3Icon, MapPinIcon, ShieldCheckIcon, SparklesIcon, TrophyIcon, UsersIcon, ZapIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SectionBadge } from "@/components/arena/arena-chrome";
import { roundLabel } from "@/lib/bracket";
import type { BracketData, Match, Participant } from "@/lib/types";
import { cn } from "@/lib/utils";

const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/**
 * Laga sorotan: yang sedang berlangsung (babak tertinggi dulu), lalu laga
 * berikutnya yang pesertanya sudah lengkap, lalu hasil terakhir.
 */
export function featuredMatch(matches: Match[]): { match: Match; kind: "live" | "next" | "last" } | null {
  const live = matches.filter((m) => m.status === "ongoing").sort((a, b) => b.round - a.round || a.matchNumber - b.matchNumber);
  if (live[0]) return { match: live[0], kind: "live" };
  const next = matches
    .filter((m) => m.status === "scheduled" && m.participantAId && m.participantBId)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.round - b.round);
  if (next[0]) return { match: next[0], kind: "next" };
  const done = matches.filter((m) => m.status === "done").sort((a, b) => b.round - a.round || (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  return done[0] ? { match: done[0], kind: "last" } : null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export function ArenaHero({ data, live }: { data: BracketData; live: ReactNode }) {
  const featured = featuredMatch(data.matches);
  const people = new Map(data.participants.map((p) => [p.id, p]));

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(110deg,#1a1a2e_0%,#2a1730_45%,#4a1424_100%)] text-white">
      <div className="arena-sunburst pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20">
        <div className="flex flex-col items-start gap-5">
          <span className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-1 font-display text-xs text-ink shadow-[3px_3px_0_0_var(--color-crimson)]">
            <SparklesIcon className="size-3.5" aria-hidden /> UNESA · 2026
          </span>
          <h1 className="font-display text-4xl leading-[1.05] [text-shadow:3px_3px_0_rgb(0_0_0/0.35)] sm:text-6xl">
            Satu panggung.
            <span className="block text-gold">Ratusan penantang.</span>
          </h1>
          <p className="max-w-xl text-base text-[#d9cbbd]">
            Pantau setiap langkah menuju gelar juara Lomba Rancang Permainan 2026—langsung, jelas, dan tanpa melewatkan satu
            laga pun.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#bracket"
              className="flex items-center gap-2 rounded-full border-2 border-white/10 bg-crimson px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_0_var(--color-gold)] transition-transform hover:-translate-y-0.5"
            >
              Masuk arena <ArrowRightIcon className="size-4" aria-hidden />
            </a>
            {live}
          </div>
        </div>

        {featured && <SpotlightCard {...featured} data={data} people={people} />}
      </div>
    </section>
  );
}

function SpotlightCard({
  match,
  kind,
  data,
  people,
}: {
  match: Match;
  kind: "live" | "next" | "last";
  data: BracketData;
  people: Map<string, Participant>;
}) {
  const room = data.rooms.find((r) => r.id === match.roomId);
  const sides = [
    { p: match.participantAId ? people.get(match.participantAId) : undefined, score: match.scoreA, avatar: "bg-ink text-white" },
    { p: match.participantBId ? people.get(match.participantBId) : undefined, score: match.scoreB, avatar: "bg-gold text-ink" },
  ];
  const heading = kind === "live" ? "Sedang berlangsung" : kind === "next" ? "Laga berikutnya" : "Hasil terakhir";

  return (
    <a
      href={`#${match.id}`}
      className="group relative block rounded-3xl bg-gold p-2 shadow-[8px_8px_0_0_rgb(0_0_0/0.3)] transition-transform hover:-translate-y-1"
    >
      <div className="rounded-[1.25rem] border-4 border-crimson bg-[#fbf1d8] p-1">
        <div className="arena-marquee h-2.5 rounded-t-xl bg-crimson" aria-hidden />
        <div className="flex flex-col gap-4 p-5 text-ink sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-block border-b-2 border-ink/20 pb-1 text-[10px] font-bold tracking-[0.15em] text-ink/60 uppercase">
                {heading}
              </div>
              <div className="mt-2 font-display text-xl text-crimson">{roundLabel(match.round)}</div>
            </div>
            {kind === "live" && (
              <span className="flex items-center gap-1 rounded bg-crimson px-2 py-1 font-display text-[10px] text-white">
                <ZapIcon className="size-3 fill-white" aria-hidden /> Live
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 border-b border-ink/15 pb-4 text-xs text-ink/60">
            {room && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden /> {room.name}
              </span>
            )}
            {match.scheduledAt && (
              <span className="flex items-center gap-1">
                <Clock3Icon className="size-3.5" aria-hidden /> {timeFormat.format(new Date(match.scheduledAt))} WIB
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {sides.map(({ p, score, avatar }, i) => (
              <div key={i}>
                {i === 1 && (
                  <div className="relative my-1 flex items-center justify-center" aria-hidden>
                    <span className="absolute inset-x-0 border-t border-dashed border-ink/25" />
                    <span className="relative bg-[#fbf1d8] px-2 font-display text-[9px] text-crimson">vs</span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-ink/10 bg-[#f6e9c4] p-3",
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
                  <span className="font-display text-2xl text-crimson tabular-nums">{score ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink/55">
            <ShieldCheckIcon className="size-3.5" aria-hidden /> Hasil diverifikasi pengawas ruangan
          </div>
        </div>
      </div>
    </a>
  );
}

export function ArenaStats({ data }: { data: BracketData }) {
  const done = data.matches.filter((m) => m.status === "done").length;
  const tiles = [
    { icon: UsersIcon, value: String(data.participants.length), label: "Peserta terdaftar" },
    { icon: MapPinIcon, value: String(data.sessionRooms.length), label: "Ruangan aktif" },
    { icon: CalendarDaysIcon, value: String(data.sessions.length), label: "Sesi pertandingan" },
    { icon: TrophyIcon, value: String(done), extra: `/ ${data.matches.length}`, label: "Laga selesai" },
  ];
  return (
    <section aria-label="Ringkasan turnamen" className="border-y-4 border-gold bg-cream">
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, value, extra, label }, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-3 border-ink/10 px-4 py-5 sm:justify-center sm:px-6",
              i % 2 === 0 && "border-r",
              i < 2 && "border-b lg:border-b-0",
              i === 1 && "lg:border-r",
              i === 2 && "lg:border-r",
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-crimson text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-2xl leading-none text-ink">
                {value}
                {extra && <span className="ml-1 font-body text-xs font-semibold text-ink/40">{extra}</span>}
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-[#716760]">{label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export { SectionBadge };
