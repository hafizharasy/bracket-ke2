// Pemanggil aksi admin dari sisi klien.

import {
  assignParticipantsAction,
  autoAssignAction,
  saveParticipantAction,
  savePairingsAction,
} from "@/app/admin/peserta/actions";
import { saveAccountAction, updateAccountStatusAction } from "@/app/admin/pengawas/actions";
import { saveRoomAction, saveSessionAction } from "@/app/admin/ruangan/actions";

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

/** Simpan peserta baru (id null) atau perubahan peserta. */
export function saveParticipant(id: string | null, values: ParticipantFormValues): Promise<AdminActionResult> {
  return saveParticipantAction(id, values);
}

export type AssignMode = "unassigned" | "all";

/** Pindahkan peserta terpilih ke satu sesi / ruangan (null = kosongkan). */
export function assignParticipants(
  ids: string[],
  target: { sessionId?: string | null; roomId?: string | null },
): Promise<AdminActionResult> {
  return assignParticipantsAction(ids, target);
}

/** Bagi otomatis peserta rata ke semua sesi. */
export function autoAssignSessions(mode: AssignMode): Promise<AdminActionResult> {
  return autoAssignAction("sesi", mode);
}

/** Tempatkan peserta satu sesi rata ke semua ruangan. */
export function autoAssignRooms(mode: AssignMode, sessionId: string): Promise<AdminActionResult> {
  return autoAssignAction("ruangan", mode, sessionId);
}

/** Urutan peserta babak 1: indeks 2k & 2k+1 = laga ke-(k+1). */
export type PairingPayload = { sessionId: string; roomId: string; order: string[] };

/** Simpan susunan pasangan babak 1 satu ruangan. */
export function savePairings(payload: PairingPayload): Promise<AdminActionResult> {
  return savePairingsAction(payload);
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

/** Simpan akun pengawas (baru/ubah). */
export async function saveAccount(id: string | null, values: AccountFormValues): Promise<AdminActionResult> {
  try {
    return await saveAccountAction(id, values);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
}

/** Aktif/nonaktifkan akun atau atur ulang sandinya. */
export async function updateAccountStatus(
  id: string,
  change: { active: boolean } | { resetPassword: string },
): Promise<AdminActionResult> {
  try {
    return await updateAccountStatusAction(id, change);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
}

export type RoomFormValues = { name: string; location: string };
export type SessionFormValues = { name: string; startTime: string };

/** Simpan nama & lokasi ruangan (state tiruan hanya saat mode mock). */
export async function saveRoom(id: string, values: RoomFormValues): Promise<AdminActionResult> {
  try {
    return await saveRoomAction(id, values);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
}

/** Simpan nama & jam mulai sesi (startTime ISO; state tiruan hanya saat mode mock). */
export async function saveSession(id: string, values: SessionFormValues): Promise<AdminActionResult> {
  try {
    return await saveSessionAction(id, values);
  } catch {
    return { ok: false, error: "Gagal menyimpan. Periksa koneksi lalu coba lagi." };
  }
}
