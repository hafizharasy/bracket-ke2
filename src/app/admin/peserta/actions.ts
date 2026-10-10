"use server";

import { assertAdminAction, getAdminSession } from "@/lib/admin-session";
import type { AdminActionResult, AssignMode, PairingPayload, ParticipantFormValues } from "@/lib/admin-client";
import { assignInput, assignParticipants, autoAssign, autoAssignInput } from "@/server/assignments";
import { generateBracketStructure } from "@/server/bracket-structure";
import { ApiError } from "@/server/errors";
import { bracketSource, notifyBracketChanged } from "@/server/live";
import { importParticipantsCsv } from "@/server/participant-import";
import { pairingInput, savePairings } from "@/server/pairings";
import { semifinalPairsInput, setSemifinalPairs } from "@/server/semifinal-pairs";
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

/** Simpan susunan pasangan babak 1 satu ruangan. */
export async function savePairingsAction(payload: PairingPayload): Promise<AdminActionResult> {
  const parsed = pairingInput.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Susunan pasangan tidak valid." };
  return run(() => savePairings(parsed.data));
}

export type GenerateBracketResult =
  | { ok: true; simulated: boolean; summary?: string }
  | { ok: false; error: string; problems?: string[] };

/** Buat (atau susun ulang) struktur bagan dari penempatan peserta. */
export async function generateBracketAction(replace: boolean): Promise<GenerateBracketResult> {
  const admin = await getAdminSession();
  if (!admin) return { ok: false, error: "Hanya admin utama yang boleh melakukan ini." };
  if (bracketSource() === "mock") return { ok: true, simulated: true };
  try {
    const result = generateBracketStructure({ replace }, admin.userId);
    notifyBracketChanged();
    return { ok: true, simulated: false, summary: `${result.rooms} ruangan (${result.roomMatches} laga), ${result.semifinalMatches} semifinal, dan ${result.finalMatches} laga final dibuat.` };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, error: error.message, problems: error.details?.errors as string[] | undefined };
  }
}

/** Atur pasangan semifinal: pairs[k] = dua laga final ruangan untuk semifinal ke-(k+1). */
export async function saveSemifinalPairsAction(pairs: [string, string][]): Promise<AdminActionResult> {
  const parsed = semifinalPairsInput.safeParse({ pairs });
  if (!parsed.success) return { ok: false, error: "Pasangan semifinal tidak valid." };
  const admin = await getAdminSession();
  return run(() => void setSemifinalPairs(parsed.data.pairs, admin?.userId ?? null));
}

export type ImportPreview = ReturnType<typeof importParticipantsCsv>;
export type ImportActionResult = ({ ok: true; simulated: boolean } & Partial<ImportPreview>) | { ok: false; error: string };

/** Unggah CSV peserta dari halaman admin: periksa dulu (`dryRun`), lalu simpan. */
export async function importParticipantsAction(text: string, options: { replace: boolean; dryRun: boolean }): Promise<ImportActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  if (text.length > 1_000_000) return { ok: false, error: "Berkas terlalu besar (maks. 1 MB)." };
  if (bracketSource() === "mock") return { ok: true, simulated: true };
  try {
    const admin = await getAdminSession();
    const result = importParticipantsCsv(text, options, admin?.userId ?? null);
    if (result.saved) notifyBracketChanged();
    return { ok: true, simulated: false, ...result };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}
