// Pemanggil aksi admin dari sisi klien.

export type ParticipantFormValues = {
  name: string;
  teamOrClub: string;
  sessionId: string;
  roomId: string;
};

export type AdminActionResult = { ok: true; simulated: boolean; id?: string } | { ok: false; error: string };

/** Validasi form peserta di klien; mengembalikan pesan per field. */
export function validateParticipant(values: ParticipantFormValues) {
  const errors: Partial<Record<keyof ParticipantFormValues, string>> = {};
  const name = values.name.trim();
  if (name.length < 2) errors.name = "Nama minimal 2 karakter.";
  else if (name.length > 100) errors.name = "Nama maksimal 100 karakter.";
  if (values.teamOrClub.trim().length > 100) errors.teamOrClub = "Maksimal 100 karakter.";
  if (values.roomId && !values.sessionId) errors.sessionId = "Pilih sesi bila ruangan diisi.";
  return errors;
}

/**
 * SEMENTARA (stub frontend): mensimulasikan simpan peserta. Akan diganti
 * endpoint tambah/ubah peserta di backend.
 */
export async function saveParticipant(
  id: string | null,
  values: ParticipantFormValues,
): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] simpan peserta", id ?? "(baru)", values);
  return { ok: true, simulated: true, id: id ?? "p-baru" };
}
