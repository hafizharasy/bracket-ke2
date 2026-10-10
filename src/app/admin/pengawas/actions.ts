"use server";

import { z } from "zod";

import type { AccountFormValues, AdminActionResult } from "@/lib/admin-client";
import { createMockAccount, updateMockAccount } from "@/lib/mock/account-store";
import { getBracket } from "@/lib/get-bracket";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";

const accountInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  roomId: z.string().min(1),
  password: z.string(),
});

/** Simpan akun pengawas ke state tiruan (validasi sama dengan form + email unik). */
export async function saveAccountAction(id: string | null, values: AccountFormValues): Promise<AdminActionResult> {
  const parsed = accountInput.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Data akun tidak valid." };
  const input = parsed.data;
  if ((id === null || input.password) && input.password.length < 8) {
    return { ok: false, error: "Sandi minimal 8 karakter." };
  }
  const [{ rooms }, accounts] = await Promise.all([getBracket(), getPengawasAccounts()]);
  if (!rooms.some((r) => r.id === input.roomId)) return { ok: false, error: "Ruangan tidak ditemukan." };
  if (accounts.some((a) => a.email === input.email && a.id !== id)) {
    return { ok: false, error: "Email sudah dipakai akun lain." };
  }

  if (id === null) {
    const created = createMockAccount({ name: input.name, email: input.email, roomId: input.roomId, active: true });
    return { ok: true, simulated: true, id: created.id };
  }
  if (!accounts.some((a) => a.id === id)) return { ok: false, error: "Akun tidak ditemukan." };
  updateMockAccount(id, { name: input.name, email: input.email, roomId: input.roomId });
  return { ok: true, simulated: true, id };
}

/** Aktif/nonaktifkan atau atur ulang sandi (sandi tidak disimpan di state tiruan). */
export async function updateAccountStatusAction(
  id: string,
  change: { active: boolean } | { resetPassword: string },
): Promise<AdminActionResult> {
  const accounts = await getPengawasAccounts();
  if (!accounts.some((a) => a.id === id)) return { ok: false, error: "Akun tidak ditemukan." };
  if ("active" in change) updateMockAccount(id, { active: change.active });
  else if (change.resetPassword.length < 8) return { ok: false, error: "Sandi minimal 8 karakter." };
  return { ok: true, simulated: true };
}
