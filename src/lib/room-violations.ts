import { getBracket } from "@/lib/get-bracket";
import { bracketSource } from "@/server/live";
import { listLocalViolations } from "@/lib/mock/violation-store";
import { VIOLATION_TYPES, type Violation } from "@/lib/violations";

/**
 * Pelanggaran tercatat di satu ruangan, terbaru dulu.
 *
 * Dari tabel `violations`; saat BRACKET_DATA_SOURCE=mock: catatan dari
 * form (daftar lokal di memori) + contoh data deterministik.
 */
export async function getRoomViolations(roomId: string): Promise<Violation[]> {
  if (bracketSource() === "db") {
    const { listRoomViolations } = await import("@/server/violations");
    return listRoomViolations(roomId);
  }
  const data = await getBracket();
  const roomMatches = data.matches.filter((m) => m.roomId === roomId && m.participantAId);
  const samples: Violation[] = [];
  roomMatches.slice(0, 12).forEach((match, i) => {
    if (i % 3 === 2) return; // tidak semua laga ada pelanggaran
    const participantId = (i % 2 === 0 ? match.participantAId : match.participantBId) ?? match.participantAId!;
    const type = VIOLATION_TYPES[(i * 7) % VIOLATION_TYPES.length];
    const base = new Date(match.scheduledAt ?? data.updatedAt).getTime();
    samples.push({
      id: `v-sim-${match.id}`,
      participantId,
      matchId: match.id,
      roomId,
      type,
      note: type === "Lainnya" ? "Contoh catatan pelanggaran (data simulasi)." : null,
      occurredAt: new Date(base + ((i % 5) + 1) * 60_000).toISOString(),
      recordedBy: "Pengawas (simulasi)",
    });
  });
  return [...listLocalViolations(roomId), ...samples].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
}
