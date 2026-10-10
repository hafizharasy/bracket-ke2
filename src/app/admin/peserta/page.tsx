import { Suspense } from "react";

import { ParticipantFormDialog } from "@/components/admin/participant-form-dialog";
import { BracketStructureCard } from "@/components/admin/bracket-structure-card";
import { CompletenessPanel } from "@/components/admin/completeness-panel";
import { ParticipantTable } from "@/components/admin/participant-table";
import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import { checkScheduleCompleteness } from "@/lib/schedule-completeness";
import { getBracket } from "@/lib/get-bracket";

export const metadata = { title: "Peserta & Jadwal" };

export default function PesertaPage({ searchParams }: PageProps<"/admin/peserta">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

/** Ringkasan pembagian peserta: matriks sesi × ruangan (target 64 per sel aktif). */
async function Overview({ searchParams }: Pick<PageProps<"/admin/peserta">, "searchParams">) {
  const [data, params] = await Promise.all([getBracket(), searchParams]);
  const { participants, sessions, rooms } = data;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const query = {
    q: str(params.q),
    sesi: str(params.sesi),
    ruangan: str(params.ruangan),
    page: Number.parseInt(str(params.hal), 10) || 1,
  };
  const unassigned = participants.filter((p) => !p.sessionId || !p.roomId).length;
  const cell = (sessionId: string, roomId: string) =>
    participants.filter((p) => p.sessionId === sessionId && p.roomId === roomId).length;
  const TARGET = PLAYERS_PER_ROOM;
  const used = new Set(data.sessionRooms.map((c) => `${c.sessionId}:${c.roomId}`));
  const isUsed = (sessionId: string, roomId: string) => used.has(`${sessionId}:${roomId}`);
  const checks = checkScheduleCompleteness(data);

  const stats = [
    { label: "Total peserta", value: participants.length },
    { label: "Belum ditempatkan", value: unassigned },
    { label: "Sesi", value: sessions.length },
    { label: "Ruangan-sesi aktif", value: data.sessionRooms.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <CompletenessPanel checks={checks} />
      <BracketStructureCard
        total={data.matches.length}
        started={data.matches.some((m) => m.status !== "scheduled")}
        placementReady={checks.filter((c) => ["session", "room", "cells"].includes(c.key)).every((c) => c.ok)}
      />
      <div className="flex justify-end">
        <ParticipantFormDialog sessions={sessions} rooms={rooms} sessionRooms={data.sessionRooms} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Sebaran peserta per sesi × ruangan</h2>
        <p className="text-xs text-muted-foreground">
          Tiap ruangan aktif berisi {TARGET} peserta (satu bagan, 63 laga). Sel berwarna menandai kekurangan/kelebihan; “—” berarti ruangan tidak dipakai di sesi itu (atur di menu Ruangan).
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sesi</th>
                {rooms.map((r) => (
                  <th key={r.id} className="px-2 py-2 text-center font-medium">
                    {r.name.replace("Ruangan ", "R")}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const counts = rooms.map((r) => cell(s.id, r.id));
                return (
                  <tr key={s.id} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{s.name}</th>
                    {counts.map((n, i) => {
                      const active = isUsed(s.id, rooms[i].id);
                      const ok = active ? n === TARGET : n === 0;
                      return (
                        <td
                          key={rooms[i].id}
                          className={
                            ok
                              ? "px-2 py-2 text-center tabular-nums" + (active ? "" : " text-muted-foreground")
                              : "bg-amber-500/15 px-2 py-2 text-center font-semibold tabular-nums text-amber-800 dark:text-amber-300"
                          }
                        >
                          {active || n ? n : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {counts.reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Daftar peserta</h2>
        <ParticipantTable participants={participants} sessions={sessions} rooms={rooms} query={query} />
      </section>
    </div>
  );
}
