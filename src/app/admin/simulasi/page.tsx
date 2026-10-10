import { Suspense } from "react";

import {
  ClearResultsForm,
  SimulateForm,
} from "@/components/admin/simulation-panel";
import { requireAdmin } from "@/lib/admin-session";
import { activeCells } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { bracketSource } from "@/server/live";

export const metadata = { title: "Simulasi" };

export default function SimulasiPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Simulasi turnamen
        </h1>
        <p className="text-sm text-muted-foreground">
          Uji coba alur turnamen dengan hasil acak, lalu kembalikan ke kondisi
          bersih sebelum hari-H. Hasil simulasi tampil di bagan publik seperti
          hasil asli — jangan dipakai saat turnamen sudah berjalan.
        </p>
      </div>
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}
      >
        <Panel />
      </Suspense>
    </main>
  );
}

async function Panel() {
  await requireAdmin("/admin/simulasi");
  const data = await getBracket();
  const stats =
    bracketSource() === "db"
      ? (await import("@/server/simulation")).simulationStatus()
      : null;
  const roomsBySession: Record<string, { id: string; name: string }[]> = {};
  for (const { session, room } of activeCells(data))
    (roomsBySession[session.id] ??= []).push({ id: room.id, name: room.name });

  const tiles = stats
    ? [
        {
          label: "Babak ruangan selesai",
          value: `${stats.room.done}/${stats.room.total}`,
        },
        {
          label: "Semifinal selesai",
          value: `${stats.semifinal.done}/${stats.semifinal.total}`,
        },
        { label: "Final selesai", value: `${stats.final.done}/${stats.final.total}` },
        { label: "Pelanggaran tercatat", value: String(stats.violations) },
      ]
    : [];

  return (
    <>
      {data.matches.length === 0 ? (
        <p className="rounded-xl border border-amber-500/60 bg-amber-500/5 p-4 text-sm">
          Struktur bagan belum dibuat. Buat dulu di{" "}
          <b>Peserta & Jadwal → Daftar Peserta → Buat struktur bagan</b>.
        </p>
      ) : (
        <>
          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    {t.label}
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {t.value}
                  </div>
                </div>
              ))}
            </div>
          )}
          <SimulateForm
            sessions={data.sessions.map((s) => ({ id: s.id, name: s.name }))}
            roomsBySession={roomsBySession}
          />
          <ClearResultsForm />
        </>
      )}
    </>
  );
}
