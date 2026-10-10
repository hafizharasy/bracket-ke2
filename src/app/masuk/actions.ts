"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { getAdminAccounts, STUB_ADMIN_COOKIE, STUB_ROLE_COOKIE } from "@/lib/admin-session";
import { safeNext, STUB_USER_COOKIE } from "@/lib/pengawas-session";
import { getPengawasAccounts } from "@/lib/pengawas-accounts";

/** Sandi demo login stub (hanya di luar production). */
const DEMO_PASSWORD = "pengawas123";
/** Sandi demo login stub admin (hanya di luar production). */
const DEMO_ADMIN_PASSWORD = "admin12345";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; /** Tautan bantuan, mis. ke halaman masuk yang benar. */ hint?: { text: string; href: string } };

const loginInput = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1) });

/**
 * SEMENTARA (stub frontend): login pengawas memakai akun dari daftar akun
 * pengawas dan sandi demo, lalu menyimpan sesi stub di cookie. Diganti
 * Better Auth pada tahap backend; di production selalu ditolak.
 */
export async function loginPengawas(email: string, password: string, next?: string): Promise<LoginResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Login belum diaktifkan di server ini. Hubungi admin." };
  }
  const parsed = loginInput.safeParse({ email, password });
  if (!parsed.success) return { ok: false, error: "Email atau sandi tidak valid." };

  const account = (await getPengawasAccounts()).find((a) => a.email === parsed.data.email);
  // Pesan sama untuk email tak dikenal & sandi salah (tidak membocorkan akun mana yang ada).
  if (!account || parsed.data.password !== DEMO_PASSWORD) {
    const isAdmin = (await getAdminAccounts()).some((a) => a.email.toLowerCase() === parsed.data.email);
    if (isAdmin && parsed.data.password === DEMO_ADMIN_PASSWORD) {
      return {
        ok: false,
        error: "Ini akun admin utama, bukan akun pengawas ruangan.",
        hint: { text: "Masuk sebagai admin utama", href: "/masuk/admin" },
      };
    }
    return { ok: false, error: "Email atau sandi salah." };
  }
  if (!account.active) return { ok: false, error: "Akun ini dinonaktifkan. Hubungi admin." };
  if (!account.roomId) return { ok: false, error: "Akun belum ditempatkan di ruangan. Hubungi admin." };

  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };
  store.set(STUB_USER_COOKIE, account.id, opts);
  store.set(STUB_ROLE_COOKIE, "pengawas", opts);
  store.delete(STUB_ADMIN_COOKIE); // satu peran per perangkat
  return { ok: true, redirectTo: safeNext(next) };
}

/** Hanya izinkan `next` berupa path area admin. */
function safeAdminNext(next: string | undefined) {
  return next && /^\/admin([/?][\w\-/?=&%.]*)?$/.test(next) ? next : "/admin";
}

/**
 * SEMENTARA (stub frontend): login admin utama memakai akun admin dan sandi
 * demo, lalu menyimpan sesi stub di cookie. Diganti Better Auth di backend;
 * di production selalu ditolak.
 */
export async function loginAdmin(email: string, password: string, next?: string): Promise<LoginResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Login belum diaktifkan di server ini." };
  }
  const parsed = loginInput.safeParse({ email, password });
  if (!parsed.success) return { ok: false, error: "Email atau sandi tidak valid." };
  const admin = (await getAdminAccounts()).find((a) => a.email.toLowerCase() === parsed.data.email);
  if (!admin || parsed.data.password !== DEMO_ADMIN_PASSWORD) {
    // Akun pengawas yang benar ditolak dengan penjelasan (bukan sekadar "salah").
    const pengawas = (await getPengawasAccounts()).find((a) => a.email === parsed.data.email);
    if (pengawas && parsed.data.password === DEMO_PASSWORD) {
      return {
        ok: false,
        error: "Akun pengawas ruangan tidak punya akses ke dashboard admin.",
        hint: { text: "Masuk ke halaman pengawas", href: "/masuk" },
      };
    }
    return { ok: false, error: "Email atau sandi salah." };
  }
  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 12 };
  store.set(STUB_ADMIN_COOKIE, admin.id, opts);
  store.set(STUB_ROLE_COOKIE, "admin", opts);
  store.delete(STUB_USER_COOKIE); // satu peran per perangkat
  return { ok: true, redirectTo: safeAdminNext(next) };
}
