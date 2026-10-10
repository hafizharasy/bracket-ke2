import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ViolationForm } from "@/components/ruangan/violation-form";
import { roundLabel, sortMatches } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { canAccessRoom, getPengawasSession } from "@/lib/pengawas-session";

export const metadata = { title: "Catat pelanggaran · Bracket LRP 2026" };

export default function CatatPelanggaranPage({ searchParams }: PageProps<"/ruangan/pelanggaran/baru">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-5">
      <Link href="/ruangan/pelanggaran" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Ringkasan pelanggaran
      </Link>
      <h1 className="font-heading text-xl font-semibold">Catat pelanggaran</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <FormLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/ruangan/pelanggaran/baru">, "searchParams">) {
  const [session, query] = await Promise.all([getPengawasSession(), searchParams]);
  const data = await getBracket();

  // Hanya laga & peserta di ruangan pengawas: peserta yang ditempatkan di
  // ruangan ini, ditambah peserta yang bertanding di laga ruangan ini.
  const roomMatches = data.matches
    .filter((m) => canAccessRoom(session, m.roomId) && (m.participantAId || m.participantBId))
    .sort(sortMatches);
  const ids = new Set(data.participants.filter((p) => p.roomId === session.roomId).map((p) => p.id));
  for (const m of roomMatches) {
    if (m.participantAId) ids.add(m.participantAId);
    if (m.participantBId) ids.add(m.participantBId);
  }
  const sessions = new Map(data.sessions.map((s) => [s.id, s.name]));
  const participants = data.participants
    .filter((p) => ids.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, club: p.teamOrClub }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  const matches = roomMatches.map((m) => ({
    id: m.id,
    label: `${sessions.get(m.sessionId)} · ${roundLabel(m.round)} #${m.matchNumber}`,
    participantIds: [m.participantAId, m.participantBId].filter((x): x is string => !!x),
  }));

  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const initialParticipantId = participants.some((p) => p.id === pick(query.peserta)) ? pick(query.peserta) : undefined;
  const initialMatchId = matches.some((m) => m.id === pick(query.laga)) ? pick(query.laga) : undefined;

  return (
    <ViolationForm
      participants={participants}
      matches={matches}
      initialParticipantId={initialParticipantId}
      initialMatchId={initialMatchId}
    />
  );
}
