"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { STUB_ROLE_COOKIE } from "@/lib/admin-session";
import { STUB_USER_COOKIE } from "@/lib/pengawas-session";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";

/** Sandi demo login stub (hanya di luar production). */
const DEMO_PASSWORD = "pengawas123";

export type LoginResult = { ok: true; redirectTo: string } | { ok: false; error: string };

const loginInput = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1) });

/**
 * SEMENTARA (stub frontend): login pengawas memakai akun dari daftar akun
 * pengawas dan sandi demo, lalu menyimpan sesi stub di cookie. Diganti
 * Better Auth pada tahap backend; di production selalu ditolak.
 */
export async function loginPengawas(email: string, password: string): Promise<LoginResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Login belum diaktifkan di server ini. Hubungi admin." };
  }
  const parsed = loginInput.safeParse({ email, password });
  if (!parsed.success) return { ok: false, error: "Email atau sandi tidak valid." };

  const account = (await getPengawasAccounts()).find((a) => a.email === parsed.data.email);
  // Pesan sama untuk email tak dikenal & sandi salah (tidak membocorkan akun mana yang ada).
  if (!account || parsed.data.password !== DEMO_PASSWORD) {
    return { ok: false, error: "Email atau sandi salah." };
  }
  if (!account.active) return { ok: false, error: "Akun ini dinonaktifkan. Hubungi admin." };
  if (!account.roomId) return { ok: false, error: "Akun belum ditempatkan di ruangan. Hubungi admin." };

  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };
  store.set(STUB_USER_COOKIE, account.id, opts);
  store.set(STUB_ROLE_COOKIE, "pengawas", opts);
  return { ok: true, redirectTo: "/ruangan" };
}
