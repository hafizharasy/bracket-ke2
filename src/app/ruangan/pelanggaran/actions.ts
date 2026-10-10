"use server";

import type { SubmitResult, ViolationPayload } from "@/lib/results-client";
import { getActingUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { bracketSource } from "@/server/live";
import { recordViolation as recordViolationService, violationInput } from "@/server/violations";

/** Simpan catatan pelanggaran dari form pengawas (layanan yang sama dengan POST /api/violations). */
export async function recordViolation(payload: ViolationPayload): Promise<SubmitResult> {
  const parsed = violationInput.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data pelanggaran tidak valid." };
  }

  if (bracketSource() === "mock") return recordMockViolation(parsed.data);

  const user = await getActingUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login kembali." };
  try {
    recordViolationService(parsed.data, user);
    return { ok: true, simulated: false };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Gagal menyimpan pelanggaran. Coba lagi." };
  }
}

/** Mode simulasi (BRACKET_DATA_SOURCE=mock): simpan ke daftar lokal di memori. */
async function recordMockViolation(input: ReturnType<typeof violationInput.parse>): Promise<SubmitResult> {
  const [{ addLocalViolation }, { getPengawasSession }] = await Promise.all([
    import("@/lib/mock/violation-store"),
    import("@/lib/pengawas-session"),
  ]);
  const session = await getPengawasSession();
  addLocalViolation({
    id: crypto.randomUUID(),
    participantId: input.participantId,
    matchId: input.matchId ?? null,
    roomId: session.roomId,
    type: input.type,
    note: input.note || null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    recordedBy: session.name,
  });
  return { ok: true, simulated: true };
}
