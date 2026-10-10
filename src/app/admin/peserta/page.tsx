import { Suspense } from "react";

import { ParticipantFormDialog } from "@/components/admin/participant-form-dialog";
import { getBracket } from "@/lib/get-bracket";

export const metadata = { title: "Peserta & Jadwal" };

export default function PesertaPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Overview />
    </Suspense>
  );
}

/** Ringkasan pembagian peserta: matriks sesi × ruangan (target 16 per sel). */
async function Overview() {
  const { participants, sessions, rooms } = await getBracket();
  const unassigned = participants.filter((p) => !p.sessionId || !p.roomId).length;
  const cell = (sessionId: string, roomId: string) =>
    participants.filter((p) => p.sessionId === sessionId && p.roomId === roomId).length;
  const TARGET = 16;

  const stats = [
    { label: "Total peserta", value: participants.length },
    { label: "Belum ditempatkan", value: unassigned },
    { label: "Sesi", value: sessions.length },
    { label: "Ruangan", value: rooms.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <ParticipantFormDialog sessions={sessions} rooms={rooms} />
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
          Tiap sel idealnya berisi {TARGET} peserta (satu bagan 16 besar). Sel berwarna menandai kekurangan/kelebihan.
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
                    {counts.map((n, i) => (
                      <td
                        key={rooms[i].id}
                        className={
                          n === TARGET
                            ? "px-2 py-2 text-center tabular-nums"
                            : "bg-amber-500/15 px-2 py-2 text-center font-semibold tabular-nums text-amber-800 dark:text-amber-300"
                        }
                      >
                        {n}
                      </td>
                    ))}
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
    </div>
  );
}
