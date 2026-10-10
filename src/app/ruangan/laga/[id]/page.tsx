import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ResultForm } from "@/components/ruangan/result-form";
import { Badge } from "@/components/ui/badge";
import { roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasSession } from "@/lib/pengawas-session";

export const metadata = { title: "Input hasil · Bracket LRP 2026" };

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
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
  const [{ id }, session] = await Promise.all([params, getPengawasSession()]);
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
  if (match.roomId !== session.roomId) {
    return (
      <>
        {back}
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Laga ini berlangsung di {room?.name ?? "ruangan lain"}. Anda hanya bisa mengisi hasil
          untuk ruangan Anda sendiri.
        </p>
      </>
    );
  }

  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const a = match.participantAId ? participants.get(match.participantAId) : undefined;
  const b = match.participantBId ? participants.get(match.participantBId) : undefined;
  const session_ = data.sessions.find((s) => s.id === match.sessionId);

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
        <ResultForm key={match.id} match={match} participantA={a} participantB={b} />
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Peserta laga ini belum lengkap. Hasil bisa diisi setelah pemenang babak sebelumnya
          ditentukan.
        </p>
      )}
    </>
  );
}
