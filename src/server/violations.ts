import { and, count, countDistinct, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants, users, violations } from "@/db/schema";
import { roundLabel } from "@/lib/bracket";
import { VIOLATION_TYPES, type Violation } from "@/lib/violations";
import { authorize, type SessionUser } from "@/server/auth";
import { ApiError } from "@/server/errors";

export const violationInput = z
  .object({
    participantId: z.string().min(1),
    matchId: z.string().min(1).nullish(),
    /** Wajib untuk admin bila tanpa laga; pengawas memakai ruangannya. */
    roomId: z.string().min(1).nullish(),
    type: z.enum(VIOLATION_TYPES),
    note: z.string().trim().max(500).nullish(),
    occurredAt: z.iso.datetime({ offset: true }).nullish(),
  })
  .refine((v) => v.type !== "Lainnya" || !!v.note, {
    message: "Isi catatan untuk jenis Lainnya.",
    path: ["note"],
  });
export type ViolationInput = z.infer<typeof violationInput>;

const toViolation = (row: typeof violations.$inferSelect & { recorderName?: string | null }): Violation => ({
  id: row.id,
  participantId: row.participantId,
  matchId: row.matchId,
  roomId: row.roomId,
  type: row.type,
  note: row.note,
  occurredAt: row.occurredAt.toISOString(),
  recordedBy: row.recorderName ?? row.recordedBy,
});

/**
 * Catat pelanggaran. Ruangan diambil dari laga (bila ada), atau dari input
 * (admin) / ruangan pengawas. Peserta harus terdaftar atau bertanding di
 * ruangan itu, dan bila ada laga, peserta harus salah satu pemainnya.
 */
export function recordViolation(input: ViolationInput, user: SessionUser): Violation {
  const participant = db.select().from(participants).where(eq(participants.id, input.participantId)).get();
  if (!participant) throw new ApiError(404, "Peserta tidak ditemukan.");

  let roomId: string | null | undefined = input.roomId ?? user.roomId;
  if (input.matchId) {
    const match = db.select().from(matches).where(eq(matches.id, input.matchId)).get();
    if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    if (match.participantAId !== participant.id && match.participantBId !== participant.id) {
      throw new ApiError(422, "Peserta tidak bertanding di laga itu.");
    }
    roomId = match.roomId;
  }
  if (!roomId) throw new ApiError(422, "Tentukan ruangan pelanggaran.");
  authorize(user, "violation:write", { roomId });

  if (!input.matchId && participant.roomId !== roomId) {
    const playsHere = db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.roomId, roomId),
          or(eq(matches.participantAId, participant.id), eq(matches.participantBId, participant.id)),
        ),
      )
      .get();
    if (!playsHere) throw new ApiError(422, "Peserta tidak terdaftar di ruangan ini.");
  }

  const row = db
    .insert(violations)
    .values({
      id: crypto.randomUUID(),
      participantId: participant.id,
      matchId: input.matchId ?? null,
      roomId,
      type: input.type,
      note: input.note || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      recordedBy: user.id,
    })
    .returning()
    .get();
  return toViolation({ ...row, recorderName: user.name });
}

/** Pelanggaran di satu ruangan, terbaru dulu, dengan nama pencatat. */
export function listRoomViolations(roomId: string): Violation[] {
  return db
    .select({ v: violations, recorderName: users.name })
    .from(violations)
    .leftJoin(users, eq(users.id, violations.recordedBy))
    .where(eq(violations.roomId, roomId))
    .orderBy(desc(violations.occurredAt))
    .all()
    .map(({ v, recorderName }) => toViolation({ ...v, recorderName }));
}

/** Sesi sebuah pelanggaran: dari laganya, atau dari sesi peserta bila di luar laga. */
const violationSession = sql<string | null>`coalesce(${matches.sessionId}, ${participants.sessionId})`;

/**
 * Daftar pelanggaran ruangan (opsional satu sesi) beserta total: jumlah,
 * peserta terlibat, per jenis, dan per peserta. Dihitung di SQL.
 */
export function getRoomViolationSummary(roomId: string, sessionId?: string | null) {
  const where: SQL | undefined = and(
    eq(violations.roomId, roomId),
    sessionId ? sql`${violationSession} = ${sessionId}` : undefined,
  );
  const base = () =>
    db
      .select()
      .from(violations)
      .innerJoin(participants, eq(participants.id, violations.participantId))
      .leftJoin(matches, eq(matches.id, violations.matchId))
      .where(where)
      .$dynamic();

  const totals = db
    .select({ total: count(), participants: countDistinct(violations.participantId) })
    .from(violations)
    .innerJoin(participants, eq(participants.id, violations.participantId))
    .leftJoin(matches, eq(matches.id, violations.matchId))
    .where(where)
    .get()!;

  const byType = db
    .select({ type: violations.type, count: count() })
    .from(violations)
    .innerJoin(participants, eq(participants.id, violations.participantId))
    .leftJoin(matches, eq(matches.id, violations.matchId))
    .where(where)
    .groupBy(violations.type)
    .orderBy(desc(count()))
    .all();

  const byParticipant = db
    .select({ participantId: participants.id, name: participants.name, count: count() })
    .from(violations)
    .innerJoin(participants, eq(participants.id, violations.participantId))
    .leftJoin(matches, eq(matches.id, violations.matchId))
    .where(where)
    .groupBy(participants.id)
    .orderBy(desc(count()), participants.name)
    .all();

  const list = base()
    .leftJoin(users, eq(users.id, violations.recordedBy))
    .orderBy(desc(violations.occurredAt))
    .all()
    .map((row) => ({
      ...toViolation({ ...row.violations, recorderName: row.users?.name }),
      participantName: row.participants.name,
      sessionId: row.matches?.sessionId ?? row.participants.sessionId,
      matchLabel: row.matches ? `${roundLabel(row.matches.round)} #${row.matches.matchNumber}` : null,
    }));

  return {
    total: totals.total,
    participantsInvolved: totals.participants,
    byType,
    byParticipant,
    violations: list,
  };
}
