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

/** Batas ukuran berkas asli yang diterima sebelum dikompres. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * Perkecil foto di browser sebelum diunggah (sisi terpanjang maks. 1600 px,
 * JPEG kualitas 0.82) supaya unggahan cepat di jaringan lapangan.
 */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses foto."))), "image/jpeg", quality),
  );
}

/**
 * SEMENTARA (stub frontend): mensimulasikan unggah foto bukti dan
 * mengembalikan URL sementara. Akan diganti endpoint unggah di backend.
 */
export async function uploadProofPhoto(matchId: string, photo: Blob): Promise<{ url: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { url: `/bukti/${matchId}-simulasi-${photo.size}.jpg` };
}

export type ViolationPayload = {
  participantId: string;
  matchId: string | null;
  type: string;
  note: string | null;
  /** ISO. */
  occurredAt: string;
};

/**
 * SEMENTARA (stub frontend): mensimulasikan penyimpanan catatan
 * pelanggaran. Akan diganti POST /api/violations.
 */
export async function submitViolation(payload: ViolationPayload): Promise<SubmitResult> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  console.info("[simulasi] catat pelanggaran", payload);
  return { ok: true, simulated: true };
}
