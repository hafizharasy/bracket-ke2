import { and, eq, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

export const assignInput = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(1000),
    sessionId: z.string().min(1).nullable().optional(),
    roomId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.sessionId !== undefined || v.roomId !== undefined, "Isi sessionId atau roomId.");
export type AssignInput = z.infer<typeof assignInput>;

export const autoAssignInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sesi"), mode: z.enum(["unassigned", "all"]) }),
  z.object({ kind: z.literal("ruangan"), mode: z.enum(["unassigned", "all"]), sessionId: z.string().min(1) }),
]);
export type AutoAssignInput = z.infer<typeof autoAssignInput>;

const byNumber = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, "id", { numeric: true });

function orderedSessions() {
  return db.select().from(sessions).all().sort((a, b) => a.orderIndex - b.orderIndex);
}
function orderedRooms() {
  return db.select().from(rooms).all().sort(byNumber);
}

/** Peserta yang sudah bertanding (laga berlangsung/selesai) tidak boleh dipindah. */
function assertNotPlayed(ids: string[] | "all", sessionId?: string) {
  const conditions = [ne(matches.status, "scheduled")];
  if (sessionId) conditions.push(eq(matches.sessionId, sessionId));
  if (ids !== "all") {
    conditions.push(or(inArray(matches.participantAId, ids), inArray(matches.participantBId, ids))!);
  }
  if (db.select({ id: matches.id }).from(matches).where(and(...conditions)).get()) {
    throw new ApiError(409, "Ada peserta yang sudah bertanding; penempatannya tidak bisa diubah lagi.");
  }
}

/** Jumlah peserta per sel sesi × ruangan, kunci `${sessionId}|${roomId}`. */
function cellCounts() {
  const counts = new Map<string, number>();
  for (const p of db.select().from(participants).all()) {
    if (p.sessionId && p.roomId) counts.set(`${p.sessionId}|${p.roomId}`, (counts.get(`${p.sessionId}|${p.roomId}`) ?? 0) + 1);
  }
  return counts;
}

/**
 * Pindahkan peserta terpilih ke satu sesi dan/atau ruangan (null = kosongkan).
 * Ganti sesi mengosongkan ruangan (kecuali ruangan ikut diisi), karena ruangan
 * berlaku per sesi. Tiap ruangan per sesi maksimal 16 peserta.
 */
export function assignParticipants(input: AssignInput) {
  const ids = [...new Set(input.ids)];
  const rows = db.select().from(participants).where(inArray(participants.id, ids)).all();
  if (rows.length !== ids.length) throw new ApiError(404, "Sebagian peserta tidak ditemukan.");
  if (input.sessionId && !db.select().from(sessions).where(eq(sessions.id, input.sessionId)).get()) {
    throw new ApiError(422, "Sesi tidak ditemukan.");
  }
  if (input.roomId && !db.select().from(rooms).where(eq(rooms.id, input.roomId)).get()) {
    throw new ApiError(422, "Ruangan tidak ditemukan.");
  }
  assertNotPlayed(ids);

  const updates = rows.map((p) => {
    const sessionId = input.sessionId !== undefined ? input.sessionId : p.sessionId;
    let roomId = input.roomId !== undefined ? input.roomId : p.roomId;
    if (input.roomId === undefined && sessionId !== p.sessionId) roomId = null;
    if (roomId && !sessionId) throw new ApiError(422, `Peserta ${p.id.toUpperCase()} belum punya sesi; atur sesinya dulu.`);
    return { id: p.id, sessionId, roomId };
  });

  // Kapasitas sel setelah pemindahan.
  const counts = cellCounts();
  for (const p of rows) if (p.sessionId && p.roomId) counts.set(`${p.sessionId}|${p.roomId}`, counts.get(`${p.sessionId}|${p.roomId}`)! - 1);
  for (const u of updates) if (u.sessionId && u.roomId) counts.set(`${u.sessionId}|${u.roomId}`, (counts.get(`${u.sessionId}|${u.roomId}`) ?? 0) + 1);
  const full = [...counts.entries()].find(([key, n]) => n > PLAYERS_PER_ROOM && updates.some((u) => `${u.sessionId}|${u.roomId}` === key));
  if (full) throw new ApiError(409, `Ruangan tujuan melebihi ${PLAYERS_PER_ROOM} peserta (${full[1]}).`);

  return write(updates);
}

function write(updates: { id: string; sessionId: string | null; roomId: string | null }[]) {
  return db.transaction((tx) => {
    const now = new Date();
    for (const u of updates) {
      tx.update(participants).set({ sessionId: u.sessionId, roomId: u.roomId, updatedAt: now }).where(eq(participants.id, u.id)).run();
    }
    if (updates.length) bumpBracketVersion(tx);
    return { updated: updates.length };
  });
}

/**
 * Isi kelompok (sesi/ruangan) secara merata: tiap peserta masuk ke kelompok
 * yang paling sedikit isinya dan masih muat. Peserta diurutkan per klub lalu
 * dibagi bergiliran, sehingga peserta satu klub tersebar ke kelompok berbeda.
 */
function distribute<T extends { id: string; teamOrClub: string | null }>(
  people: T[],
  groups: string[],
  filled: Map<string, number>,
  capacity: number,
) {
  const sorted = [...people].sort((a, b) => (a.teamOrClub ?? "").localeCompare(b.teamOrClub ?? "") || byNumber(a, b));
  const result = new Map<string, string>();
  for (const person of sorted) {
    const target = groups
      .filter((g) => (filled.get(g) ?? 0) < capacity)
      .sort((a, b) => (filled.get(a) ?? 0) - (filled.get(b) ?? 0))[0];
    if (!target) throw new ApiError(409, "Kapasitas tidak cukup untuk semua peserta.");
    filled.set(target, (filled.get(target) ?? 0) + 1);
    result.set(person.id, target);
  }
  return result;
}

/**
 * Bagi otomatis. `sesi`: peserta dibagi rata ke semua sesi (kapasitas
 * jumlah ruangan × 16); bagi ulang "all" juga mengosongkan ruangan.
 * `ruangan`: peserta satu sesi dibagi rata ke semua ruangan (maks. 16).
 */
export function autoAssign(input: AutoAssignInput) {
  const all = db.select().from(participants).all();
  const roomIds = orderedRooms().map((r) => r.id);

  if (input.kind === "sesi") {
    const sessionIds = orderedSessions().map((s) => s.id);
    if (sessionIds.length === 0) throw new ApiError(409, "Belum ada sesi.");
    const people = input.mode === "all" ? all : all.filter((p) => !p.sessionId);
    if (input.mode === "all") assertNotPlayed("all");
    const filled = new Map<string, number>();
    if (input.mode === "unassigned") for (const p of all) if (p.sessionId) filled.set(p.sessionId, (filled.get(p.sessionId) ?? 0) + 1);
    const plan = distribute(people, sessionIds, filled, roomIds.length * PLAYERS_PER_ROOM);
    return write(people.map((p) => {
      const sessionId = plan.get(p.id)!;
      return { id: p.id, sessionId, roomId: input.mode === "all" ? null : p.roomId };
    }));
  }

  if (!db.select().from(sessions).where(eq(sessions.id, input.sessionId)).get()) throw new ApiError(404, "Sesi tidak ditemukan.");
  if (roomIds.length === 0) throw new ApiError(409, "Belum ada ruangan.");
  const inSession = all.filter((p) => p.sessionId === input.sessionId);
  const people = input.mode === "all" ? inSession : inSession.filter((p) => !p.roomId);
  if (input.mode === "all") assertNotPlayed("all", input.sessionId);
  const filled = new Map<string, number>();
  if (input.mode === "unassigned") for (const p of inSession) if (p.roomId) filled.set(p.roomId, (filled.get(p.roomId) ?? 0) + 1);
  const plan = distribute(people, roomIds, filled, PLAYERS_PER_ROOM);
  return write(people.map((p) => ({ id: p.id, sessionId: input.sessionId, roomId: plan.get(p.id)! })));
}
