"use server";

import { z } from "zod";

import { assertAdminAction } from "@/lib/admin-session";
import type { AdminActionResult, RoomFormValues, SessionFormValues } from "@/lib/admin-client";
import { getBracket } from "@/lib/get-bracket";
import { updateMockRoom, updateMockSession } from "@/lib/mock/structure-store";

const name = z.string().trim().min(2).max(50);

/** Simpan nama & lokasi ruangan ke state tiruan (nama harus unik). */
export async function saveRoomAction(id: string, values: RoomFormValues): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = z.object({ name, location: z.string().trim().max(100) }).safeParse(values);
  if (!parsed.success) return { ok: false, error: "Data ruangan tidak valid." };
  const { rooms } = await getBracket();
  if (!rooms.some((r) => r.id === id)) return { ok: false, error: "Ruangan tidak ditemukan." };
  if (rooms.some((r) => r.id !== id && r.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { ok: false, error: "Nama ruangan sudah dipakai." };
  }
  updateMockRoom(id, { name: parsed.data.name, location: parsed.data.location || null });
  return { ok: true, simulated: true, id };
}

/** Simpan nama & jam mulai sesi ke state tiruan (nama unik, urutan jam tetap naik). */
export async function saveSessionAction(id: string, values: SessionFormValues): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = z.object({ name, startTime: z.iso.datetime() }).safeParse(values);
  if (!parsed.success) return { ok: false, error: "Data sesi tidak valid." };
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
