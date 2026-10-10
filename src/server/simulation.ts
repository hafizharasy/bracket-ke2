// Alat uji coba admin: isi hasil acak sesuai aturan tiap babak, dan hapus
// semua hasil supaya turnamen kembali bersih (peserta, ruangan, sesi,
// struktur bagan, pasangan babak 1, pasangan semifinal, akun, dan nama
// pengawas tidak disentuh).

import { eq, gt, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { backupDatabase } from "@/db/backup";
import { matches, matchResultHistory, matchResults, violations } from "@/db/schema";
import { FINAL_ROUND, LAST_ROOM_ROUND, SEMIFINAL_ROUND, SEMIFINAL_WINS } from "@/lib/bracket";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";
import { advanceToFeeds, advanceWinner } from "@/server/propagation";

export const SIMULATION_STAGES = ["ruangan", "semifinal", "final", "semua"] as const;
export type SimulationStage = (typeof SIMULATION_STAGES)[number];

export const simulationInput = z.object({
  /** ruangan = babak 1–6 (bisa dibatasi sesi/ruangan); semua = sampai juara. */
  stage: z.enum(SIMULATION_STAGES),
  sessionId: z.string().min(1).nullish(),
  roomId: z.string().min(1).nullish(),
});
export type SimulationInput = z.infer<typeof simulationInput>;

type Rand = () => number;
const pick = <T>(list: readonly T[], rand: Rand) => list[Math.floor(rand() * list.length)];

/** Hasil acak yang sah untuk babak laga tersebut. */
export function randomResult(round: number, a: string, b: string, rand: Rand = Math.random) {
  const aWins = rand() < 0.5;
  const winnerId = aWins ? a : b;
  if (round === FINAL_ROUND) {
    // Kemenangan telak lebih jarang daripada kemenangan biasa.
    const winType = pick(["empat", "tiga", "tiga", "tiga_tercepat", "tiga_tercepat", "dua_terbanyak"] as const, rand);
    return { winnerId, scoreA: null, scoreB: null, winType };
  }
  const loser = round === SEMIFINAL_ROUND ? Math.floor(rand() * SEMIFINAL_WINS) : Math.floor(rand() * 4);
  const winner = round === SEMIFINAL_ROUND ? SEMIFINAL_WINS : loser + 1 + Math.floor(rand() * 3);
  return { winnerId, scoreA: aWins ? winner : loser, scoreB: aWins ? loser : winner, winType: null };
}

/**
 * Selesaikan laga yang belum selesai dalam cakupan dengan hasil acak,
 * berulang sampai tidak ada lagi laga siap (pemenang maju membuat laga
 * babak berikutnya siap). Laga yang pesertanya belum lengkap dilewati.
 */
export function simulateResults(input: SimulationInput, actorId: string | null, rand: Rand = Math.random) {
  const rounds =
    input.stage === "ruangan"
      ? { min: 1, max: LAST_ROOM_ROUND }
      : input.stage === "semifinal"
        ? { min: SEMIFINAL_ROUND, max: SEMIFINAL_ROUND }
        : input.stage === "final"
          ? { min: FINAL_ROUND, max: FINAL_ROUND }
          : { min: 1, max: FINAL_ROUND };
  const inScope = (m: typeof matches.$inferSelect) =>
    m.round >= rounds.min &&
    m.round <= rounds.max &&
    // Filter sesi/ruangan hanya untuk babak ruangan.
    (m.round > LAST_ROOM_ROUND || ((!input.sessionId || m.sessionId === input.sessionId) && (!input.roomId || m.roomId === input.roomId)));

  return db.transaction((tx) => {
    let finished = 0;
    for (;;) {
      const ready = tx
        .select()
        .from(matches)
        .where(ne(matches.status, "done"))
        .all()
        .filter((m) => m.participantAId && m.participantBId && inScope(m))
        .sort((x, y) => x.round - y.round || x.matchNumber - y.matchNumber);
      if (ready.length === 0) break;
      for (const match of ready) {
        const result = randomResult(match.round, match.participantAId!, match.participantBId!, rand);
        const updated = tx
          .update(matches)
          .set({ ...result, status: "done" })
          .where(eq(matches.id, match.id))
          .returning()
          .get();
        advanceWinner(tx, updated, null);
        advanceToFeeds(tx, updated, null);
        finished++;
      }
    }
    const remaining = tx
      .select({ n: sql<number>`count(*)` })
      .from(matches)
      .where(ne(matches.status, "done"))
      .get()!.n;
    if (finished > 0) {
      bumpBracketVersion(tx);
      recordAudit(
        { actorId, action: "simulation.results", entity: "bracket", entityId: null, summary: `Simulasi: ${finished} laga diisi hasil acak.` },
        tx,
      );
    }
    return { finished, remaining };
  });
}

/**
 * Kembalikan semua laga ke terjadwal tanpa skor/pemenang; slot babak 2 ke
 * atas dikosongkan lagi (diisi ulang oleh pemenang saat turnamen berjalan).
 * Catatan bukti & jejak hasil dihapus; pelanggaran ikut dihapus bila diminta.
 * Database dicadangkan dulu.
 */
export function clearAllResults(options: { violations: boolean }, actorId: string | null) {
  const total = db.select({ n: sql<number>`count(*)` }).from(matches).get()!.n;
  if (total === 0) throw new ApiError(409, "Struktur bagan belum dibuat; belum ada hasil untuk dihapus.");
  const backup = backupDatabase("sebelum-hapus-hasil");

  return db.transaction((tx) => {
    const cleared = tx
      .select({ n: sql<number>`count(*)` })
      .from(matches)
      .where(ne(matches.status, "scheduled"))
      .get()!.n;
    tx.delete(matchResultHistory).run();
    tx.delete(matchResults).run();
    const removedViolations = options.violations ? tx.delete(violations).run().changes : 0;
    tx.update(matches).set({ status: "scheduled", scoreA: null, scoreB: null, winnerId: null, winType: null }).run();
    tx.update(matches).set({ participantAId: null, participantBId: null }).where(gt(matches.round, 1)).run();
    bumpBracketVersion(tx);
    recordAudit(
      {
        actorId,
        action: "simulation.clear",
        entity: "bracket",
        entityId: null,
        summary: `Semua hasil dihapus (${cleared} laga)${options.violations ? `, ${removedViolations} pelanggaran` : ""}.`,
      },
      tx,
    );
    return { cleared, removedViolations, backup };
  });
}

/** Ringkasan progres untuk halaman simulasi. */
export function simulationStatus() {
  const rows = db
    .select({ round: matches.round, status: matches.status, n: sql<number>`count(*)` })
    .from(matches)
    .groupBy(matches.round, matches.status)
    .all();
  const stage = (from: number, to: number) => {
    const list = rows.filter((r) => r.round >= from && r.round <= to);
    return {
      total: list.reduce((n, r) => n + r.n, 0),
      done: list.filter((r) => r.status === "done").reduce((n, r) => n + r.n, 0),
    };
  };
  const results = db.select({ n: sql<number>`count(*)` }).from(matchResults).get()!.n;
  const violationCount = db.select({ n: sql<number>`count(*)` }).from(violations).get()!.n;
  return {
    room: stage(1, LAST_ROOM_ROUND),
    semifinal: stage(SEMIFINAL_ROUND, SEMIFINAL_ROUND),
    final: stage(FINAL_ROUND, FINAL_ROUND),
    proofs: results,
    violations: violationCount,
  };
}
