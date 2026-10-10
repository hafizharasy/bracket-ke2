import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, participants, users, violations } from "@/db/schema";
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
