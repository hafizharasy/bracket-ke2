// SEMENTARA (tahap frontend): data tiruan Rekap & Ekspor dari bagan tiruan,
// dengan pelanggaran, pencatat, koreksi, dan bukti contoh yang deterministik.
// Diganti data database di tahap backend.

import { mockBracket } from "@/lib/mock/bracket-data";
import { buildRecap, type RecapData, type RecapFilters, type ResultMeta } from "@/lib/recap";
import { VIOLATION_TYPES, type Violation } from "@/lib/violations";

export function getMockRecap(filters: RecapFilters): RecapData {
  const meta = new Map<string, ResultMeta>();
  mockBracket.matches.forEach((m, i) => {
    if (m.status !== "done" || !m.scheduledAt) return;
    meta.set(m.id, {
      recordedAt: new Date(new Date(m.scheduledAt).getTime() + 11 * 60_000).toISOString(),
      recordedBy: `Pengawas ${mockBracket.rooms.find((r) => r.id === m.roomId)?.name ?? m.roomId}`,
      corrections: i % 23 === 0 ? 1 : 0,
      hasProof: true,
    });
  });

  const violations: Violation[] = [];
  mockBracket.matches
    .filter((m) => m.round === 1 && m.status === "done" && m.participantAId && m.participantBId)
    .forEach((m, i) => {
      if (i % 4 !== 1) return; // sekitar seperempat laga babak 1 ada pelanggaran
      // Sebaran jenis tidak merata (terlambat paling sering), seperti di lapangan.
      const weights = [0, 0, 0, 1, 1, 2, 3, 4, 5];
      const type = VIOLATION_TYPES[weights[(i * 7 + Math.floor(i / 9)) % weights.length]];
      violations.push({
        id: `v-tiruan-${m.id}`,
        participantId: i % 2 ? m.participantAId! : m.participantBId!,
        matchId: m.id,
        roomId: m.roomId,
        type,
        note: type === "Lainnya" ? "Contoh catatan pelanggaran (data tiruan)." : null,
        occurredAt: new Date(new Date(m.scheduledAt ?? 0).getTime() + ((i % 5) + 2) * 60_000).toISOString(),
        recordedBy: `Pengawas ${mockBracket.rooms.find((r) => r.id === m.roomId)?.name ?? m.roomId}`,
      });
      // Sebagian peserta melanggar lagi di laga yang sama (peserta berulang).
      if (i % 9 === 1) {
        const first = violations.at(-1)!;
        violations.push({
          ...first,
          id: `${first.id}-2`,
          type: "Perilaku tidak sportif",
          note: null,
          occurredAt: new Date(new Date(first.occurredAt).getTime() + 3 * 60_000).toISOString(),
        });
      }
    });

  return buildRecap(mockBracket, violations, filters, meta);
}
