"use server";

import { getActingUser } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { matchResultInput, recordMatchResult } from "@/server/match-results";
import type { ResultPayload, SubmitResult } from "@/lib/results-client";

/**
 * Simpan hasil laga dari form pengawas: skor, pemenang, foto bukti, status
 * selesai, dan propagasi pemenang — memakai layanan yang sama dengan
 * PUT /api/matches/:id/result.
 */
export async function saveMatchResult(matchId: string, payload: ResultPayload): Promise<SubmitResult> {
  const user = await getActingUser();
  if (!user) return { ok: false, error: "Sesi berakhir. Silakan login kembali." };

  const parsed = matchResultInput.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Data hasil tidak valid. Periksa skor dan foto bukti." };

  try {
    recordMatchResult(matchId, parsed.data, user);
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Gagal menyimpan hasil. Coba lagi." };
  }
  notifyBracketChanged();
  return { ok: true, simulated: false };
}
