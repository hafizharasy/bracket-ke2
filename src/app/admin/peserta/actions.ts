"use server";

import { assertAdminAction } from "@/lib/admin-session";
import type { AdminActionResult, AssignMode, ParticipantFormValues } from "@/lib/admin-client";
import { assignInput, assignParticipants, autoAssign, autoAssignInput } from "@/server/assignments";
import { ApiError } from "@/server/errors";
import { bracketSource, notifyBracketChanged } from "@/server/live";
import {
  createParticipant,
  participantCreateInput,
  updateParticipant,
} from "@/server/participants";

/** Tambah (id null) atau ubah peserta lewat layanan peserta di database. */
export async function saveParticipantAction(
  id: string | null,
  values: ParticipantFormValues,
): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  const parsed = participantCreateInput.safeParse({
    name: values.name,
    teamOrClub: values.teamOrClub,
    sessionId: values.sessionId || null,
    roomId: values.roomId || null,
  });
  if (!parsed.success) return { ok: false, error: "Data peserta tidak valid." };
  // Mode simulator membaca bagan tiruan, bukan database: jangan tulis apa pun.
  if (bracketSource() === "mock") return { ok: true, simulated: true, id: id ?? "p-baru" };
  try {
    const row = id ? updateParticipant(id, parsed.data) : createParticipant(parsed.data);
    notifyBracketChanged();
    return { ok: true, simulated: false, id: row.id };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Jalankan penulisan admin: tolak non-admin, simulasi di mode mock, petakan ApiError. */
async function run(write: () => void): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  if (bracketSource() === "mock") return { ok: true, simulated: true };
  try {
    write();
    notifyBracketChanged();
    return { ok: true, simulated: false };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Pindahkan peserta terpilih ke satu sesi / ruangan (null = kosongkan). */
export async function assignParticipantsAction(
  ids: string[],
  target: { sessionId?: string | null; roomId?: string | null },
): Promise<AdminActionResult> {
  const parsed = assignInput.safeParse({ ids, ...target });
  if (!parsed.success) return { ok: false, error: "Pilih peserta dan tujuan yang valid." };
  return run(() => assignParticipants(parsed.data));
}

/** Bagi otomatis peserta rata ke semua sesi, atau peserta satu sesi ke semua ruangan. */
export async function autoAssignAction(
  kind: "sesi" | "ruangan",
  mode: AssignMode,
  sessionId?: string,
): Promise<AdminActionResult> {
  const parsed = autoAssignInput.safeParse({ kind, mode, sessionId });
  if (!parsed.success) return { ok: false, error: "Pilihan pembagian tidak valid." };
  return run(() => autoAssign(parsed.data));
}
