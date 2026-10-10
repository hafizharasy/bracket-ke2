import { ArrowLeftIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { roundLabel, sortMatches } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { canAccessRoom, requirePengawas } from "@/lib/pengawas-session";
import { getRoomViolations } from "@/lib/room-violations";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pelanggaran peserta · Bracket LRP 2026" };

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default function PelanggaranPesertaPage({ params }: PageProps<"/ruangan/pelanggaran/peserta/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-5">
      <Link href="/ruangan/pelanggaran" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        Ringkasan pelanggaran
      </Link>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <ParticipantViolations params={params} />
      </Suspense>
    </main>
  );
}

async function ParticipantViolations({ params }: Pick<PageProps<"/ruangan/pelanggaran/peserta/[id]">, "params">) {
  const [{ id }, session] = await Promise.all([params, requirePengawas("/ruangan/pelanggaran")]);
  const [data, roomViolations] = await Promise.all([getBracket(), getRoomViolations(session.roomId)]);
  const participant = data.participants.find((p) => p.id === id);
  if (!participant) notFound();

  // Hanya data di ruangan pengawas: pelanggaran yang dicatat di ruangan ini
  // dan laga peserta yang dimainkan di ruangan ini.
  const violations = roomViolations.filter((v) => v.participantId === id);
  const matches = data.matches
    .filter((m) => canAccessRoom(session, m.roomId) && (m.participantAId === id || m.participantBId === id))
    .sort(sortMatches);
  const matchMap = new Map(data.matches.map((m) => [m.id, m]));
  const sessions = new Map(data.sessions.map((s) => [s.id, s.name]));
  const opponentName = (matchId: string) => {
    const m = matchMap.get(matchId);
    const oppId = m?.participantAId === id ? m?.participantBId : m?.participantAId;
    return data.participants.find((p) => p.id === oppId)?.name;
  };
  const byType = [...Map.groupBy(violations, (v) => v.type)].sort((a, b) => b[1].length - a[1].length);

  if (violations.length === 0 && matches.length === 0 && participant.roomId !== session.roomId) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Peserta ini tidak terdaftar atau bertanding di ruangan Anda.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-semibold">{participant.name}</h1>
          <p className="text-sm text-muted-foreground">
            {participant.teamOrClub ?? "Tanpa klub"} · {participant.id.toUpperCase()}
          </p>
        </div>
        <Link
          href={`/ruangan/pelanggaran/baru?peserta=${participant.id}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          <PlusIcon className="size-4" /> Catat
        </Link>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-3",
          violations.length > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5",
        )}
      >
        <span className="text-3xl font-semibold tabular-nums">{violations.length}</span>
        <span className="text-sm">
          {violations.length > 0 ? "pelanggaran tercatat di ruangan ini" : "Tidak ada pelanggaran tercatat."}
          {byType.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              {byType.map(([type, list]) => `${type} (${list.length})`).join(" · ")}
            </span>
          )}
        </span>
        {violations.length === 0 && <ShieldCheckIcon className="ml-auto size-5 text-emerald-600" />}
      </div>

      {violations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Riwayat pelanggaran</h2>
          <ol className="relative flex flex-col gap-3 border-l pl-4">
            {violations.map((v) => {
              const m = v.matchId ? matchMap.get(v.matchId) : undefined;
              return (
                <li key={v.id} className="relative flex flex-col gap-0.5 text-sm">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-amber-500" />
                  <span className="text-xs text-muted-foreground">{dateTimeFormat.format(new Date(v.occurredAt))} WIB</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">{v.type}</span>
                  {m && (
                    <span className="text-xs text-muted-foreground">
                      {sessions.get(m.sessionId)} · {roundLabel(m.round)} #{m.matchNumber}
                      {opponentName(m.id) ? ` vs ${opponentName(m.id)}` : ""}
                    </span>
                  )}
                  {v.note && <p className="text-muted-foreground">{v.note}</p>}
                  <span className="text-xs text-muted-foreground">Dicatat oleh {v.recordedBy}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {matches.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Laga di ruangan ini</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {matches.map((m) => {
              const count = violations.filter((v) => v.matchId === m.id).length;
              const won = m.winnerId === id;
              return (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {roundLabel(m.round)} #{m.matchNumber}
                    <span className="text-muted-foreground"> vs {opponentName(m.id) ?? "—"}</span>
                  </span>
                  {m.status === "done" && (
                    <span className={cn("text-xs font-medium", won ? "text-emerald-600" : "text-muted-foreground")}>
                      {won ? "Menang" : "Kalah"}
                    </span>
                  )}
                  {count > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {count}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
