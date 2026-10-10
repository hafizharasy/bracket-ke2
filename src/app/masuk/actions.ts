"use server";

import { headers } from "next/headers";

import { safeNext } from "@/lib/pengawas-session";
import { loginWithPassword } from "@/server/login";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; /** Tautan bantuan, mis. ke halaman masuk yang benar. */ hint?: { text: string; href: string } };

async function login(email: string, password: string, role: "admin" | "pengawas", redirectTo: string): Promise<LoginResult> {
  const result = await loginWithPassword({ email, password }, role, { headers: await headers() });
  return result.ok ? { ok: true, redirectTo } : { ok: false, error: result.error, hint: result.hint };
}

/** Login pengawas ruangan (Better Auth, email + sandi). */
export async function loginPengawas(email: string, password: string, next?: string): Promise<LoginResult> {
  return login(email, password, "pengawas", safeNext(next));
}

/** Hanya izinkan `next` berupa path area admin. */
function safeAdminNext(next: string | undefined) {
  return next && /^\/admin([/?][\w\-/?=&%.]*)?$/.test(next) ? next : "/admin";
}

/** Login admin utama (Better Auth, email + sandi). */
export async function loginAdmin(email: string, password: string, next?: string): Promise<LoginResult> {
  return login(email, password, "admin", safeAdminNext(next));
}
