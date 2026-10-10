"use server";

import { assertAdminAction } from "@/lib/admin-session";
import type { AccountFormValues, AdminActionResult } from "@/lib/admin-client";
import { ApiError } from "@/server/errors";
import {
  createPengawas,
  logoutPengawasEverywhere,
  pengawasCreateInput,
  pengawasUpdateInput,
  updatePengawas,
} from "@/server/pengawas-accounts";

async function run(write: () => Promise<{ id: string }>): Promise<AdminActionResult> {
  const denied = await assertAdminAction();
  if (denied) return denied;
  try {
    const { id } = await write();
    return { ok: true, simulated: false, id };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  }
}

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0]?.message ?? "Data akun tidak valid.";

/** Buat akun pengawas (id null) atau ubah nama/email/ruangan (+ sandi bila diisi). */
export async function saveAccountAction(id: string | null, values: AccountFormValues): Promise<AdminActionResult> {
  if (id === null) {
    const parsed = pengawasCreateInput.safeParse(values);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    return run(() => createPengawas(parsed.data));
  }
  const parsed = pengawasUpdateInput.safeParse({ ...values, password: values.password || undefined });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return run(() => updatePengawas(id, parsed.data));
}

/**
 * Aktif/nonaktifkan akun, atur ulang sandinya, atau keluarkan dari semua
 * perangkat. Nonaktif & atur ulang sandi juga mengakhiri sesi login akun itu.
 */
export async function updateAccountStatusAction(
  id: string,
  change: { active: boolean } | { resetPassword: string } | { logout: true },
): Promise<AdminActionResult> {
  if ("logout" in change) return run(async () => (logoutPengawasEverywhere(id), { id }));
  const parsed = pengawasUpdateInput.safeParse("active" in change ? { active: change.active } : { password: change.resetPassword });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  return run(() => updatePengawas(id, parsed.data));
}
