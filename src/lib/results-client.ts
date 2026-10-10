// Pemanggil API hasil laga dari sisi klien (form pengawas).

export type ResultPayload = {
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  proofPhotoUrl?: string;
};

export type SubmitResult = { ok: true; simulated: boolean } | { ok: false; error: string };

/**
 * SEMENTARA (stub frontend): mensimulasikan penyimpanan tanpa memanggil
 * server. Akan diganti PUT /api/matches/:id/result saat backend dihubungkan.
 */
export async function submitMatchResult(
  matchId: string,
  payload: ResultPayload,
): Promise<SubmitResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.info("[simulasi] simpan hasil", matchId, payload);
  return { ok: true, simulated: true };
}
