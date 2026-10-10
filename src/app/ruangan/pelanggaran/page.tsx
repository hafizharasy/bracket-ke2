import { PlusIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { roundLabel } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { requirePengawas } from "@/lib/pengawas-session";
import { getRoomViolations } from "@/lib/room-violations";
import { VIOLATION_TYPES } from "@/lib/violations";

export const metadata = { title: "Pelanggaran · Bracket LRP 2026" };

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default function PelanggaranPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
        <Summary />
      </Suspense>
    </main>
  );
}

async function Summary() {
  const session = await requirePengawas("/ruangan/pelanggaran");
  const [violations, data] = await Promise.all([getRoomViolations(session.roomId), getBracket()]);
  const room = data.rooms.find((r) => r.id === session.roomId);
  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const matches = new Map(data.matches.map((m) => [m.id, m]));

  const byType = VIOLATION_TYPES.map((type) => ({
    type,
    count: violations.filter((v) => v.type === type).length,
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxType = Math.max(1, ...byType.map((t) => t.count));

  const perParticipant = [...Map.groupBy(violations, (v) => v.participantId)]
    .map(([id, list]) => ({ participant: participants.get(id), count: list.length }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">Pelanggaran</h1>
          <p className="text-sm text-muted-foreground">{room?.name} · ringkasan semua sesi</p>
        </div>
        <Link
          href="/ruangan/pelanggaran/baru"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          <PlusIcon className="size-4" />
          Catat
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total pelanggaran" value={violations.length} />
        <Stat label="Peserta terlibat" value={perParticipant.length} />
      </div>

      {violations.length === 0 ? (
        <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <ShieldAlertIcon className="size-6" />
          Belum ada pelanggaran tercatat di ruangan ini.
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Per jenis</h2>
            <ul className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              {byType.map(({ type, count }) => (
                <li key={type} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{type}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${(count / maxType) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Peserta dengan pelanggaran</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {perParticipant.slice(0, 5).map(({ participant, count }) => (
                <li key={participant?.id}>
                  <Link
                    href={`/ruangan/pelanggaran/peserta/${participant?.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate">{participant?.name ?? "?"}</span>
                    <span className="text-xs text-muted-foreground">{participant?.id.toUpperCase()}</span>
                    <span className="w-6 text-right font-semibold tabular-nums">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Catatan terbaru</h2>
            <ol className="flex flex-col gap-2">
              {violations.slice(0, 10).map((v) => {
                const match = v.matchId ? matches.get(v.matchId) : undefined;
                return (
                  <li key={v.id} className="flex flex-col gap-0.5 rounded-xl border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/ruangan/pelanggaran/peserta/${v.participantId}`}
                        className="font-medium hover:underline"
                      >
                        {participants.get(v.participantId)?.name}
                      </Link>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeFormat.format(new Date(v.occurredAt))}
                      </span>
                    </div>
                    <span className="text-amber-700 dark:text-amber-400">{v.type}</span>
                    {match && (
                      <span className="text-xs text-muted-foreground">
                        {roundLabel(match.round)} #{match.matchNumber}
                      </span>
                    )}
                    {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
