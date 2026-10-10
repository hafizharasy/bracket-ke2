import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OtherRoomNotice } from "@/components/ruangan/other-room-notice";
import { type NextPreview, ResultForm } from "@/components/ruangan/result-form";
import { Badge } from "@/components/ui/badge";
import { buildAdvanceMap, buildSlotLabels, LAST_ROOM_ROUND, roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { canAccessRoom, requirePengawas } from "@/lib/pengawas-session";

export const metadata = { title: "Input hasil · Bracket LRP 2026" };

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

const shortTime = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default function InputHasilPage({ params }: PageProps<"/ruangan/laga/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-5">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <MatchInput params={params} />
      </Suspense>
    </main>
  );
}

async function MatchInput({ params }: Pick<PageProps<"/ruangan/laga/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requirePengawas("/ruangan")]);
  const data = await getBracket();
  const match = data.matches.find((m) => m.id === id);
  if (!match) notFound();

  const room = data.rooms.find((r) => r.id === match.roomId);
  const backHref = `/ruangan?sesi=${match.sessionId}`;
  const back = (
    <Link href={backHref} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" />
      Daftar laga
    </Link>
  );

  // Pengawas hanya boleh mengisi hasil di ruangannya sendiri.
  if (!canAccessRoom(session, match.roomId)) {
    return (
      <>
        {back}
        <OtherRoomNotice roomName={room?.name} />
      </>
    );
  }

  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const a = match.participantAId ? participants.get(match.participantAId) : undefined;
  const b = match.participantBId ? participants.get(match.participantBId) : undefined;
  const session_ = data.sessions.find((s) => s.id === match.sessionId);

  // Pratinjau babak lanjut: laga tujuan, slot, dan calon lawan pemenang.
  let next: NextPreview = { kind: match.round === LAST_ROOM_ROUND ? "final-stage" : "champion" };
  const nextMatch = match.nextMatchId ? data.matches.find((m) => m.id === match.nextMatchId) : undefined;
  if (nextMatch) {
    const side = buildAdvanceMap(data.matches).get(match.id)?.side ?? "B";
    const opponentId = side === "A" ? nextMatch.participantBId : nextMatch.participantAId;
    const labels = buildSlotLabels(data.matches, {
      sessions: new Map(data.sessions.map((s) => [s.id, s])),
      rooms: new Map(data.rooms.map((r) => [r.id, r])),
    }).get(nextMatch.id);
    const opponent = opponentId ? participants.get(opponentId) : undefined;
    next = {
      kind: "match",
      label: `${roundLabel(nextMatch.round)} #${nextMatch.matchNumber}`,
      roomName: data.rooms.find((r) => r.id === nextMatch.roomId)?.name ?? null,
      time: nextMatch.scheduledAt ? shortTime.format(new Date(nextMatch.scheduledAt)) : null,
      status: nextMatch.status,
      opponent: opponent?.name ?? (side === "A" ? labels?.b.text : labels?.a.text) ?? "Belum diketahui",
      opponentKnown: !!opponent,
    };
  }

  return (
    <>
      {back}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-semibold">
            {roundLabel(match.round)} · Laga #{match.matchNumber}
          </h1>
          {match.status === "ongoing" && <Badge className="bg-red-600 text-white">LIVE</Badge>}
          {match.status === "done" && <Badge variant="secondary">Selesai</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {[session_?.name, room?.name, match.scheduledAt && `${timeFormat.format(new Date(match.scheduledAt))} WIB`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">Durasi: 7 menit + 3 menit injury time</p>
      </div>

      {a && b ? (
        <>
          <ResultForm key={match.id} match={match} participantA={a} participantB={b} next={next} />
          <Link
            href={`/ruangan/pelanggaran/baru?laga=${match.id}`}
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ShieldAlertIcon className="size-4" />
            Catat pelanggaran di laga ini
          </Link>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Peserta laga ini belum lengkap. Hasil bisa diisi setelah pemenang babak sebelumnya
          ditentukan.
        </p>
      )}
    </>
  );
}
