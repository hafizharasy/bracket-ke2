// Pemanggil penyimpanan dari sisi klien (form pengawas) lewat Server Actions.

import { saveMatchResult } from "@/app/ruangan/laga/actions";
import { recordViolation } from "@/app/ruangan/pelanggaran/actions";

export type ResultPayload = {
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  proofPhotoUrl?: string;
};

export type SubmitResult = { ok: true; simulated: boolean } | { ok: false; error: string };

/** Simpan hasil laga lewat Server Action (skor, pemenang, bukti, status selesai). */
export async function submitMatchResult(
  matchId: string,
  payload: ResultPayload,
): Promise<SubmitResult> {
  try {
    return await saveMatchResult(matchId, payload);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
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

/** Unggah foto bukti ke POST /api/matches/:id/proof; melempar Error berisi pesan server. */
export async function uploadProofPhoto(matchId: string, photo: Blob): Promise<{ url: string }> {
  const form = new FormData();
  form.append("photo", photo, "bukti.jpg");
  const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/proof`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Gagal mengunggah foto.");
  return { url: body.url };
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
 * Simpan catatan pelanggaran. Saat ini ke daftar lokal di server (Server
 * Action, belum database); nanti diganti penyimpanan ke tabel violations.
 */
export async function submitViolation(payload: ViolationPayload): Promise<SubmitResult> {
  try {
    return await recordViolation(payload);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
}
