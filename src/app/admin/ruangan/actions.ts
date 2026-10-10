"use server";

import { assertAdminAction } from "@/lib/admin-session";
import type { AdminActionResult, RoomFormValues, SessionFormValues } from "@/lib/admin-client";
import { getBracket } from "@/lib/get-bracket";
import { updateMockRoom, updateMockSession } from "@/lib/mock/structure-store";
import { ApiError } from "@/server/errors";
import { bracketSource, notifyBracketChanged } from "@/server/live";
import { roomInput, sessionScheduleInput, updateRoom, updateSessionSchedule } from "@/server/schedule";

/** Tulis ke database (mode db) lalu beri tahu bagan publik & pengawas. */
function persist(id: string, write: () => unknown): AdminActionResult {
  try {
    write();
    notifyBracketChanged();
    return { ok: true, simulated: false, id };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Simpan nama & lokasi ruangan (nama harus unik). */
export async function saveRoomAction(id: string, values: RoomFormValues): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = roomInput.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Data ruangan tidak valid." };
  if (bracketSource() === "db") return persist(id, () => updateRoom(id, parsed.data));

  const { rooms } = await getBracket();
  if (!rooms.some((r) => r.id === id)) return { ok: false, error: "Ruangan tidak ditemukan." };
  if (rooms.some((r) => r.id !== id && r.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { ok: false, error: "Nama ruangan sudah dipakai." };
  }
  updateMockRoom(id, { name: parsed.data.name, location: parsed.data.location || null });
  return { ok: true, simulated: true, id };
}

/**
 * Simpan nama & jam mulai sesi (nama unik, urutan jam tetap naik). Di
 * database, jadwal laga sesi itu ikut digeser sebesar perubahan jam mulai.
 */
export async function saveSessionAction(id: string, values: SessionFormValues): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = sessionScheduleInput.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Data sesi tidak valid." };
  if (bracketSource() === "db") return persist(id, () => updateSessionSchedule(id, parsed.data));

  const { sessions } = await getBracket();
  const index = sessions.findIndex((s) => s.id === id);
  if (index < 0) return { ok: false, error: "Sesi tidak ditemukan." };
  if (sessions.some((s) => s.id !== id && s.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { ok: false, error: "Nama sesi sudah dipakai." };
  }
  const start = parsed.data.startTime;
  const prev = sessions[index - 1]?.startTime;
  const next = sessions[index + 1]?.startTime;
  if ((prev && start <= prev) || (next && start >= next)) {
    return { ok: false, error: "Jam mulai harus setelah sesi sebelumnya dan sebelum sesi berikutnya." };
  }
  updateMockSession(id, { name: parsed.data.name, startTime: start });
  return { ok: true, simulated: true, id };
}
