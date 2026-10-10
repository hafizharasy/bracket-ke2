"use server";

import { APIError } from "better-auth/api";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { authAccounts, users } from "@/db/schema";
import { safeNext } from "@/lib/pengawas-session";
import { auth } from "@/server/better-auth";

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; /** Tautan bantuan, mis. ke halaman masuk yang benar. */ hint?: { text: string; href: string } };

const loginInput = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1) });
const WRONG = { ok: false, error: "Email atau sandi salah." } as const;

type Role = (typeof users.$inferSelect)["role"];

/**
 * Periksa email + sandi tanpa membuat sesi, supaya peran & status akun bisa
 * dijelaskan sebelum login. Pesan sama untuk email tak dikenal & sandi salah.
 */
async function checkCredentials(email: string, password: string) {
  const row = db
    .select({ id: users.id, role: users.role, roomId: users.roomId, active: users.active, hash: authAccounts.password })
    .from(users)
    .innerJoin(authAccounts, and(eq(authAccounts.userId, users.id), eq(authAccounts.providerId, "credential")))
    .where(eq(users.email, email))
    .get();
  if (!row?.hash) return null;
  return (await verifyPassword({ hash: row.hash, password })) ? row : null;
}

/** Buat sesi Better Auth; cookie dipasang lewat plugin nextCookies. */
async function signIn(email: string, password: string): Promise<LoginResult | null> {
  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    return null;
  } catch (error) {
    if (error instanceof APIError) return WRONG;
    throw error;
  }
}

async function login(
  email: string,
  password: string,
  role: Role,
  redirectTo: string,
): Promise<LoginResult> {
  const parsed = loginInput.safeParse({ email, password });
  if (!parsed.success) return { ok: false, error: "Email atau sandi tidak valid." };
  const account = await checkCredentials(parsed.data.email, parsed.data.password);
  if (!account) return WRONG;
  if (account.role !== role) {
    return role === "pengawas"
      ? {
          ok: false,
          error: "Ini akun admin utama, bukan akun pengawas ruangan.",
          hint: { text: "Masuk sebagai admin utama", href: "/masuk/admin" },
        }
      : {
          ok: false,
          error: "Akun pengawas ruangan tidak punya akses ke dashboard admin.",
          hint: { text: "Masuk ke halaman pengawas", href: "/masuk" },
        };
  }
  if (!account.active) return { ok: false, error: "Akun ini dinonaktifkan. Hubungi admin." };
  if (role === "pengawas" && !account.roomId) return { ok: false, error: "Akun belum ditempatkan di ruangan. Hubungi admin." };

  // Satu peran per perangkat: sesi baru menggantikan cookie sesi sebelumnya.
  return (await signIn(parsed.data.email, parsed.data.password)) ?? { ok: true, redirectTo };
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
