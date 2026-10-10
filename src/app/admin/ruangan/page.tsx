import { Suspense } from "react";

import { EntityEditButton } from "@/components/admin/entity-edit-dialog";
import { AddRoomForm, AddSessionForm, DeleteRoomButton, SessionRoomsEditor } from "@/components/admin/session-rooms-manager";
import { LAST_ROOM_ROUND, PLAYERS_PER_ROOM } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";

export const metadata = { title: "Ruangan & Sesi" };

const dt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default function RuanganSesiPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Ruangan & Sesi</h1>
        <p className="text-sm text-muted-foreground">
          Atur ruangan yang dipakai tiap sesi (tiap ruangan = {PLAYERS_PER_ROOM} peserta, 63 laga), tambah atau hapus
          ruangan, serta ubah nama & jam mulai sesi. Juara tiap ruangan-sesi maju ke semifinal.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Lists />
      </Suspense>
    </main>
  );
}

async function Lists() {
  const [{ sessions, rooms, participants, matches, sessionRooms }, accounts] = await Promise.all([getBracket(), getPengawasAccounts()]);
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
  const started = matches.some((m) => m.status !== "scheduled");
  const cells = sessionRooms.length;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Sesi ({sessions.length})</h2>
        <p className="text-xs text-muted-foreground">
          {cells} ruangan-sesi aktif → {cells} juara ruangan masuk semifinal
          {cells >= 4 && cells % 2 === 0 ? ` (${cells / 2} finalis)` : " — jumlahnya harus genap dan minimal 4"}.
          {started && " Turnamen sudah berjalan, ruangan per sesi terkunci."}
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {sessions.map((s) => {
            const list = matches.filter((m) => m.sessionId === s.id && m.round <= LAST_ROOM_ROUND);
            const done = list.filter((m) => m.status === "done").length;
            const counts: Record<string, number> = {};
            for (const p of participants) if (p.sessionId === s.id && p.roomId) counts[p.roomId] = (counts[p.roomId] ?? 0) + 1;
            return (
              <li key={s.id} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="w-20 font-medium">{s.name}</span>
                  <span className="min-w-56 flex-1 text-muted-foreground">
                    {s.startTime ? `${dt.format(new Date(s.startTime))} WIB` : <span className="text-amber-700">Jam mulai belum diatur</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {participants.filter((p) => p.sessionId === s.id).length} peserta · {done}/{list.length} laga selesai
                  </span>
                  <EntityEditButton kind="session" item={s} />
                </div>
                <SessionRoomsEditor
                  key={sessionRooms.filter((c) => c.sessionId === s.id).map((c) => c.roomId).join(",")}
                  sessionId={s.id}
                  rooms={sortedRooms}
                  active={sessionRooms.filter((c) => c.sessionId === s.id).map((c) => c.roomId)}
                  counts={counts}
                  locked={started}
                />
              </li>
            );
          })}
        </ul>
        <AddSessionForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Ruangan ({rooms.length})</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {sortedRooms.map((r) => {
            const pengawas = accounts.filter((a) => a.roomId === r.id && a.active);
            const usedIn = sessionRooms.filter((c) => c.roomId === r.id).length;
            const inUse = participants.some((p) => p.roomId === r.id) || matches.some((m) => m.roomId === r.id) || accounts.some((a) => a.roomId === r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                <span className="w-28 font-medium">{r.name}</span>
                <span className="min-w-40 flex-1 text-muted-foreground">{r.location ?? "Lokasi belum diisi"}</span>
                <span className="text-xs text-muted-foreground">
                  {pengawas.length ? pengawas.map((a) => a.name).join(", ") : <span className="text-amber-700 dark:text-amber-400">Tanpa pengawas</span>}
                  {" · "}
                  {participants.filter((p) => p.roomId === r.id).length} peserta · dipakai {usedIn} sesi
                </span>
                <EntityEditButton kind="room" item={r} />
                <DeleteRoomButton room={r} disabled={inUse} />
              </li>
            );
          })}
        </ul>
        <AddRoomForm />
      </section>
    </>
  );
}
