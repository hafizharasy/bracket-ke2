"use server";

import { assertAdminAction } from "@/lib/admin-session";
import type { AdminActionResult, ParticipantFormValues } from "@/lib/admin-client";
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
