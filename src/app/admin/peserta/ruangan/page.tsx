import Link from "next/link";
import { Suspense } from "react";

import { AutoAssignButton } from "@/components/admin/auto-assign-button";
import { BulkAssign } from "@/components/admin/bulk-assign";
import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { cn } from "@/lib/utils";

export const metadata = { title: "Penempatan Ruangan" };

export default function PenempatanRuanganPage({ searchParams }: PageProps<"/admin/peserta/ruangan">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <RoomAssignment searchParams={searchParams} />
    </Suspense>
  );
}

async function RoomAssignment({ searchParams }: Pick<PageProps<"/admin/peserta/ruangan">, "searchParams">) {
  const [{ participants, sessions, rooms }, params] = await Promise.all([getBracket(), searchParams]);
  const session = sessions.find((s) => s.id === params.sesi) ?? sessions[0];
  if (!session) return <p className="text-sm text-muted-foreground">Belum ada sesi.</p>;

  // Penempatan ruangan dilakukan per sesi: peserta sesi ini saja.
  const inSession = participants.filter((p) => p.sessionId === session.id);
  const unassigned = inSession.filter((p) => !p.roomId).length;
  const noSession = participants.filter((p) => !p.sessionId).length;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Pilih sesi" className="flex flex-wrap gap-1.5">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/admin/peserta/ruangan?sesi=${s.id}`}
            scroll={false}
            aria-current={s.id === session.id ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium",
              s.id === session.id ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s.name}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {session.name}: {inSession.length} peserta · target {PLAYERS_PER_ROOM} per ruangan.
          {noSession > 0 && (
            <>
              {" "}
              <Link href="/admin/peserta/sesi" className="text-amber-700 underline underline-offset-2 dark:text-amber-400">
                {noSession} peserta belum punya sesi
              </Link>
              .
            </>
          )}
        </p>
        <AutoAssignButton
          key={session.id}
          label="Tempatkan rata otomatis"
          kind="ruangan"
          sessionId={session.id}
          unassignedCount={unassigned}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {rooms.map((r) => {
          const n = inSession.filter((p) => p.roomId === r.id).length;
          const off = n !== PLAYERS_PER_ROOM;
          return (
            <div key={r.id} className={cn("rounded-xl border bg-card p-3", off && "border-amber-500/60")}>
              <div className="text-sm font-medium">{r.name}</div>
              {r.location && <div className="truncate text-xs text-muted-foreground">{r.location}</div>}
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {n}
                <span className="text-sm font-normal text-muted-foreground"> / {PLAYERS_PER_ROOM}</span>
              </div>
            </div>
          );
        })}
        <div className={cn("rounded-xl border border-dashed p-3", unassigned > 0 && "border-amber-500/60 bg-amber-500/5")}>
          <div className="text-sm font-medium">Belum ada ruangan</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{unassigned}</div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pindahkan peserta {session.name} antar ruangan</h2>
        <BulkAssign
          key={session.id}
          rows={inSession.map((p) => ({ id: p.id, name: p.name, groupId: p.roomId }))}
          groups={rooms.map((r) => ({ id: r.id, name: r.name }))}
          field="roomId"
          noun="ruangan"
        />
      </section>
    </div>
  );
}
