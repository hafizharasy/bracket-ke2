import { Suspense } from "react";

import { type RoomChampion, SemifinalPairsEditor } from "@/components/admin/semifinal-pairs-editor";
import { activeCells, LAST_ROOM_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { getBracket } from "@/lib/get-bracket";

export const metadata = { title: "Pasangan Semifinal" };

export default function SemifinalPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Pairs />
    </Suspense>
  );
}

async function Pairs() {
  const data = await getBracket();
  const semis = data.matches.filter((m) => m.round === SEMIFINAL_ROUND).sort((a, b) => a.matchNumber - b.matchNumber);
  if (semis.length === 0) {
    return <p className="text-sm text-muted-foreground">Struktur bagan belum dibuat. Buat dulu di tab Daftar Peserta.</p>;
  }

  // Urutan juara mengikuti urutan ruangan-sesi (sesi, lalu nama ruangan).
  const order = new Map(activeCells(data).map((c, i) => [`${c.session.id}:${c.room.id}`, i]));
  const sessionName = new Map(data.sessions.map((s) => [s.id, s.name]));
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const personName = new Map(data.participants.map((p) => [p.id, p.teamOrClub ? `${p.name} (${p.teamOrClub})` : p.name]));
  const roomFinals = data.matches
    .filter((m) => m.round === LAST_ROOM_ROUND)
    .sort((a, b) => (order.get(`${a.sessionId}:${a.roomId}`) ?? 999) - (order.get(`${b.sessionId}:${b.roomId}`) ?? 999));
  const champions: RoomChampion[] = roomFinals.map((m) => ({
    matchId: m.id,
    label: `Juara ${sessionName.get(m.sessionId) ?? m.sessionId} · ${roomName.get(m.roomId) ?? m.roomId}`,
    winner: m.status === "done" && m.winnerId ? (personName.get(m.winnerId) ?? m.winnerId) : null,
  }));
  const initial = semis.map((sf) => {
    const ids = roomFinals.filter((m) => m.nextMatchId === sf.id).map((m) => m.id);
    return [ids[0] ?? "", ids[1] ?? ""] as [string, string];
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {champions.length} juara ruangan-sesi bertanding di {semis.length} semifinal (best of 3, menang 2 game). Pemenang
        tiap semifinal menjadi finalis ({semis.length} finalis, double round-robin). Memilih juara yang sudah dipakai akan
        menukarnya otomatis.
      </p>
      <SemifinalPairsEditor
        key={JSON.stringify(initial)}
        champions={champions}
        initial={initial}
        locked={semis.some((m) => m.status !== "scheduled")}
      />
    </div>
  );
}
