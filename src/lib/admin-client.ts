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

export type AssignMode = "unassigned" | "all";

/**
 * SEMENTARA (stub frontend): pindahkan peserta terpilih ke satu sesi /
 * ruangan (null = kosongkan). Akan diganti endpoint pembagian di backend.
 */
export async function assignParticipants(
  ids: string[],
  target: { sessionId?: string | null; roomId?: string | null },
): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] pindahkan peserta", ids.length, target);
  return { ok: true, simulated: true };
}

/** SEMENTARA (stub frontend): bagi otomatis peserta rata ke semua sesi. */
export async function autoAssignSessions(mode: AssignMode): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] bagi sesi otomatis", mode);
  return { ok: true, simulated: true };
}

/** SEMENTARA (stub frontend): tempatkan peserta satu sesi rata ke semua ruangan. */
export async function autoAssignRooms(mode: AssignMode, sessionId: string): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] tempatkan ruangan otomatis", mode, sessionId);
  return { ok: true, simulated: true };
}

/** Urutan peserta babak 1: indeks 2k & 2k+1 = laga ke-(k+1). */
export type PairingPayload = { sessionId: string; roomId: string; order: string[] };

/** SEMENTARA (stub frontend): simpan susunan pasangan babak 1 satu ruangan. */
export async function savePairings(payload: PairingPayload): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] simpan pasangan", payload);
  return { ok: true, simulated: true };
}

export type AccountFormValues = { name: string; email: string; roomId: string; password: string };

export function validateAccount(values: AccountFormValues, isNew: boolean) {
  const errors: Partial<Record<keyof AccountFormValues, string>> = {};
  if (values.name.trim().length < 2) errors.name = "Nama minimal 2 karakter.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Email tidak valid.";
  if (!values.roomId) errors.roomId = "Pengawas wajib punya ruangan.";
  if (isNew || values.password) {
    if (values.password.length < 8) errors.password = "Sandi minimal 8 karakter.";
  }
  return errors;
}

/** Sandi acak mudah dibaca (tanpa karakter mirip seperti 0/O, 1/l). */
export function generatePassword(length = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

/** SEMENTARA (stub frontend): simpan akun pengawas (baru/ubah). */
export async function saveAccount(id: string | null, values: AccountFormValues): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.info("[simulasi] simpan akun", id ?? "(baru)", { ...values, password: values.password ? "***" : "" });
  return { ok: true, simulated: true };
}

/** SEMENTARA (stub frontend): aktif/nonaktifkan akun atau atur ulang sandinya. */
export async function updateAccountStatus(
  id: string,
  change: { active: boolean } | { resetPassword: string },
): Promise<AdminActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  console.info("[simulasi] ubah akun", id, "active" in change ? change : { resetPassword: "***" });
  return { ok: true, simulated: true };
}
