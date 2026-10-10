import { asc, count, ne } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchOfficials, matchResultHistory, matchResults, participants, rooms, sessionRooms, sessions, violations } from "@/db/schema";
import { FINAL_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { buildBracketStructure } from "@/lib/bracket-structure";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

export type GenerateOptions = {
  /** Jam mulai semifinal (ISO); default 150 menit setelah sesi terakhir. */
  finalStart?: string;
  /** Ganti struktur yang sudah ada (hanya bila belum ada laga dimulai/hasil). */
  replace?: boolean;
  /** Cek saja tanpa menyimpan. */
  dryRun?: boolean;
};

/** Jumlah laga yang ada & apakah sudah ada yang dimulai/punya hasil. */
export function bracketStatus() {
  const total = db.select({ n: count() }).from(matches).get()!.n;
  const started = db.select({ n: count() }).from(matches).where(ne(matches.status, "scheduled")).get()!.n;
  const results = db.select({ n: count() }).from(matchResults).get()!.n;
  return { total, started: started + results > 0 };
}

/**
 * Buat struktur bagan dari penempatan peserta di database: laga babak ruangan
 * (dengan pasangan babak 1, sebisa mungkin beda sekolah), semifinal, final,
 * tautan pemenang, dan jadwal. Pasangan bisa diubah admin setelahnya.
 */
export function generateBracketStructure(options: GenerateOptions = {}, actorId: string | null = null) {
  const status = bracketStatus();
  if (status.total > 0 && !options.replace) {
    throw new ApiError(409, `Struktur bagan sudah ada (${status.total} laga). Pakai opsi ganti untuk menyusun ulang.`);
  }
  if (status.started) throw new ApiError(409, "Sudah ada laga yang dimulai atau punya hasil; struktur bagan tidak bisa disusun ulang.");

  const result = buildBracketStructure({
    sessions: db
      .select()
      .from(sessions)
      .orderBy(asc(sessions.orderIndex))
      .all()
      .map((s) => ({ id: s.id, name: s.name, startTime: s.startTime?.toISOString() ?? null })),
    rooms: db
      .select({ id: rooms.id, name: rooms.name })
      .from(rooms)
      .all()
      .sort((a, b) => a.id.localeCompare(b.id, "id", { numeric: true })),
    sessionRooms: db.select().from(sessionRooms).all(),
    participants: db
      .select({ id: participants.id, teamOrClub: participants.teamOrClub, sessionId: participants.sessionId, roomId: participants.roomId })
      .from(participants)
      .all(),
    finalStart: options.finalStart,
  });
  if (!result.ok) throw new ApiError(422, "Penempatan peserta belum siap untuk dibuat bagan.", { errors: result.errors });
  if (options.dryRun) return { ...result.summary, replaced: status.total, saved: false };

  db.transaction((tx) => {
    if (status.total > 0) {
      // Belum ada hasil (dicek di atas): jejak pembatalan & tautan pelanggaran ke laga lama dibersihkan.
      tx.delete(matchResultHistory).run();
      tx.delete(matchOfficials).run();
      tx.update(violations).set({ matchId: null }).run();
      tx.delete(matches).run();
    }
    // Laga tujuan disisipkan lebih dulu: semifinal, final (feed ke semifinal),
    // lalu babak ruangan dari final ruangan ke babak 1 (nextMatchId).
    const rank = (round: number) => (round === SEMIFINAL_ROUND ? 0 : round === FINAL_ROUND ? 1 : 2 + (SEMIFINAL_ROUND - round));
    const ordered = [...result.matches].sort((a, b) => rank(a.round) - rank(b.round) || a.matchNumber - b.matchNumber);
    for (let i = 0; i < ordered.length; i += 50) tx.insert(matches).values(ordered.slice(i, i + 50)).run();
    bumpBracketVersion(tx);
    recordAudit(
      {
        actorId,
        action: status.total > 0 ? "bracket.regenerate" : "bracket.generate",
        entity: "bracket",
        summary: `Struktur bagan dibuat: ${result.summary.rooms} ruangan (${result.summary.roomMatches} laga), ${result.summary.semifinalMatches} semifinal, ${result.summary.finalMatches} laga final`,
      },
      tx,
    );
  });
  return { ...result.summary, replaced: status.total, saved: true };
}
