"use server";

import { z } from "zod";

import { getBracket } from "@/lib/get-bracket";
import { addLocalViolation } from "@/lib/mock/violation-store";
import { canAccessRoom, getPengawasSession } from "@/lib/pengawas-session";
import type { SubmitResult, ViolationPayload } from "@/lib/results-client";

const violationInput = z.object({
  participantId: z.string().min(1),
  matchId: z.string().min(1).nullable(),
  type: z.string().trim().min(1).max(100),
  note: z.string().trim().max(500).nullable(),
  occurredAt: z.iso.datetime(),
});

/**
 * Simpan catatan pelanggaran ke daftar lokal (memori server) setelah
 * memastikan peserta & laga berada di ruangan pengawas.
 */
export async function recordViolation(payload: ViolationPayload): Promise<SubmitResult> {
  const parsed = violationInput.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Data pelanggaran tidak valid." };
  const input = parsed.data;
  if (input.type === "Lainnya" && !input.note) {
    return { ok: false, error: "Isi catatan untuk jenis Lainnya." };
  }

  const session = await getPengawasSession();
  const data = await getBracket();
  const participant = data.participants.find((p) => p.id === input.participantId);
  if (!participant) return { ok: false, error: "Peserta tidak ditemukan." };

  if (input.matchId) {
    const match = data.matches.find((m) => m.id === input.matchId);
    if (!match || !canAccessRoom(session, match.roomId)) {
      return { ok: false, error: "Laga tidak ada di ruangan Anda." };
    }
    if (match.participantAId !== participant.id && match.participantBId !== participant.id) {
      return { ok: false, error: "Peserta tidak bertanding di laga itu." };
    }
  } else {
    const playsHere = data.matches.some(
      (m) => canAccessRoom(session, m.roomId) && (m.participantAId === participant.id || m.participantBId === participant.id),
    );
    if (participant.roomId !== session.roomId && !playsHere) {
      return { ok: false, error: "Peserta tidak terdaftar di ruangan Anda." };
    }
  }

  addLocalViolation({
    id: crypto.randomUUID(),
    participantId: participant.id,
    matchId: input.matchId,
    roomId: session.roomId,
    type: input.type,
    note: input.note || null,
    occurredAt: input.occurredAt,
    recordedBy: session.name,
  });
  return { ok: true, simulated: true };
}
