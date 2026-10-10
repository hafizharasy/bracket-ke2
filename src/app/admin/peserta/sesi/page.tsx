import { Suspense } from "react";

import { AutoAssignButton } from "@/components/admin/auto-assign-button";
import { BulkAssign } from "@/components/admin/bulk-assign";
import { getBracket } from "@/lib/get-bracket";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pembagian Sesi" };

const dateTime = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

export default function PembagianSesiPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <SessionAssignment />
    </Suspense>
  );
}

async function SessionAssignment() {
  const { participants, sessions } = await getBracket();
  const target = Math.ceil(participants.length / Math.max(1, sessions.length));
  const unassigned = participants.filter((p) => !p.sessionId).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Target {target} peserta per sesi ({participants.length} peserta ÷ {sessions.length} sesi).
        </p>
        <AutoAssignButton label="Bagi rata otomatis" kind="sesi" unassignedCount={unassigned} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {sessions.map((s) => {
          const n = participants.filter((p) => p.sessionId === s.id).length;
          const off = n !== target;
          return (
            <div key={s.id} className={cn("flex flex-col gap-1 rounded-xl border bg-card p-3", off && "border-amber-500/60")}>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{s.name}</span>
                {s.startTime && <span className="text-xs text-muted-foreground">{dateTime.format(new Date(s.startTime))}</span>}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {n}
                <span className="text-sm font-normal text-muted-foreground"> / {target}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", off ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${Math.min(100, (n / target) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className={cn("flex flex-col gap-1 rounded-xl border border-dashed p-3", unassigned > 0 && "border-amber-500/60 bg-amber-500/5")}>
          <span className="font-medium">Belum ada sesi</span>
          <div className="text-2xl font-semibold tabular-nums">{unassigned}</div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Pindahkan peserta antar sesi</h2>
        <BulkAssign
          rows={participants.map((p) => ({ id: p.id, name: p.name, groupId: p.sessionId }))}
          groups={sessions.map((s) => ({ id: s.id, name: s.name }))}
          field="sessionId"
          noun="sesi"
        />
      </section>
    </div>
  );
}
