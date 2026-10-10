import { ArrowLeftIcon, ArrowRightIcon, CameraOffIcon, PencilIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OtherRoomNotice } from "@/components/ruangan/other-room-notice";
import { Badge } from "@/components/ui/badge";
import { getMatchDetail, type MatchDetail } from "@/db/queries/match-detail";
import { canAccessRoom, requirePengawas } from "@/lib/pengawas-session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Detail hasil · Bracket LRP 2026" };

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
const fmt = (iso: string | null) => (iso ? `${dateTimeFormat.format(new Date(iso))} WIB` : "–");

const STATUS = { scheduled: "Terjadwal", ongoing: "Berlangsung", done: "Selesai" } as const;

export default function DetailHasilPage({ params }: PageProps<"/ruangan/riwayat/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-5">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: Pick<PageProps<"/ruangan/riwayat/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requirePengawas("/ruangan/riwayat")]);
  const match = await getMatchDetail(id);
  if (!match) notFound();

  const back = (
    <Link href="/ruangan/riwayat" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" />
      Riwayat hasil
    </Link>
  );
  if (!canAccessRoom(session, match.room.id)) {
    return (
      <>
        {back}
        <OtherRoomNotice roomName={match.room.name} />
      </>
    );
  }

  return (
    <>
      {back}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">
            {match.roundLabel} · Laga #{match.matchNumber}
          </h1>
          <Badge variant={match.status === "done" ? "secondary" : "outline"}>{STATUS[match.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {match.session.name} · {match.room.name} · {fmt(match.scheduledAt)}
        </p>
      </div>

      <Scoreboard match={match} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Foto bukti</h2>
        {match.result?.proofPhotoUrl ? (
          <a href={match.result.proofPhotoUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL bukti bisa dari penyimpanan mana pun */}
            <img src={match.result.proofPhotoUrl} alt={`Foto bukti laga #${match.matchNumber}`} className="max-h-[28rem] w-full object-contain" />
          </a>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            <CameraOffIcon className="size-6" />
            Belum ada foto bukti untuk laga ini.
          </div>
        )}
        {match.result?.recordedAt && (
          <p className="text-xs text-muted-foreground">Dicatat {fmt(match.result.recordedAt)}</p>
        )}
      </section>

      {match.nextMatch && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-3 text-sm">
          Pemenang maju ke <ArrowRightIcon className="size-3.5" />
          <span className="font-medium">{match.nextMatch.label}</span>
          <span className="text-muted-foreground">· {match.nextMatch.room.name}</span>
        </p>
      )}

      {match.participantA && match.participantB && (
        <Link
          href={`/ruangan/laga/${match.id}`}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-muted"
        >
          <PencilIcon className="size-4" />
          {match.status === "done" ? "Koreksi hasil" : "Input hasil"}
        </Link>
      )}
    </>
  );
}

function Scoreboard({ match }: { match: MatchDetail }) {
  const sides = [
    { p: match.participantA, score: match.scoreA, label: match.sources.a?.label },
    { p: match.participantB, score: match.scoreB, label: match.sources.b?.label },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {sides.map(({ p, score, label }, i) => {
        const won = !!p && p.id === match.winnerId;
        return (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-4 text-center",
              won && "border-emerald-500 bg-emerald-500/5",
            )}
          >
            <span className="text-4xl font-bold tabular-nums">{score ?? "–"}</span>
            <span className={cn("font-medium leading-tight", !p && "italic text-muted-foreground")}>
              {p?.name ?? (label ? `Pemenang ${label}` : "Belum ada")}
            </span>
            {p && <span className="text-xs text-muted-foreground">{p.teamOrClub ?? "Tanpa klub"} · {p.id.toUpperCase()}</span>}
            {won && (
              <Badge className="mt-1 bg-emerald-600 text-white">
                <TrophyIcon data-icon="inline-start" /> Pemenang
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}
