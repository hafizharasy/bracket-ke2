import { APIError } from "better-auth/api";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { authAccounts, rooms, users, USER_ROLES } from "@/db/schema";
import { auth } from "@/server/better-auth";
import { purgeExpiredSessions, revokeSessions } from "@/server/credentials";
import { getLockout, recordLoginAttempt } from "@/server/login-attempts";

type Role = (typeof USER_ROLES)[number];

export const loginInput = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(200) });

export type LoginFailure = {
  ok: false;
  /** Kode untuk status HTTP: invalid 422, wrong 401, role/inactive/no-room 403, locked 423. */
  code: "invalid" | "wrong" | "role" | "inactive" | "no-room" | "locked";
  error: string;
  /** Tautan bantuan, mis. ke halaman masuk yang benar. */
  hint?: { text: string; href: string };
  retryAt?: string;
};
export type LoginSuccess = {
  ok: true;
  user: { id: string; name: string; role: Role; roomId: string | null };
  room: { id: string; name: string } | null;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Periksa email + sandi tanpa membuat sesi. */
async function checkCredentials(email: string, password: string) {
  const row = db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      roomId: users.roomId,
      active: users.active,
      hash: authAccounts.password,
    })
    .from(users)
    .innerJoin(authAccounts, and(eq(authAccounts.userId, users.id), eq(authAccounts.providerId, "credential")))
    .where(eq(users.email, email))
    .get();
  if (!row?.hash) return null;
  return (await verifyPassword({ hash: row.hash, password })) ? row : null;
}

/**
 * Login email + sandi untuk satu peran (halaman login pengawas / admin).
 * Urutan: penguncian tebakan sandi → cek sandi → peran → status aktif →
 * ruangan (pengawas) → buat sesi Better Auth (cookie dipasang lewat plugin
 * nextCookies). Pesan sama untuk email tak dikenal & sandi salah. Setiap
 * percobaan dicatat di login_attempts.
 */
export async function loginWithPassword(
  values: { email: string; password: string },
  role: Role,
  request: { headers: Headers },
): Promise<LoginSuccess | LoginFailure> {
  const parsed = loginInput.safeParse(values);
  if (!parsed.success) return { ok: false, code: "invalid", error: "Email atau sandi tidak valid." };
  const { email, password } = parsed.data;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const lockout = getLockout(email);
  if (lockout.locked) {
    return {
      ok: false,
      code: "locked",
      error: `Terlalu banyak percobaan gagal. Coba lagi pukul ${timeFormat.format(lockout.retryAt)} WIB atau hubungi admin.`,
      retryAt: lockout.retryAt.toISOString(),
    };
  }

  const account = await checkCredentials(email, password);
  if (!account) {
    recordLoginAttempt({ email, role, success: false, ipAddress });
    const after = getLockout(email);
    return {
      ok: false,
      code: "wrong",
      error: after.locked
        ? `Email atau sandi salah. Terlalu banyak percobaan gagal; coba lagi pukul ${timeFormat.format(after.retryAt)} WIB.`
        : "Email atau sandi salah.",
      ...(after.locked && { retryAt: after.retryAt.toISOString() }),
    };
  }
  if (account.role !== role) {
    return role === "pengawas"
      ? {
          ok: false,
          code: "role",
          error: "Ini akun admin utama, bukan akun pengawas ruangan.",
          hint: { text: "Masuk sebagai admin utama", href: "/masuk/admin" },
        }
      : {
          ok: false,
          code: "role",
          error: "Akun pengawas ruangan tidak punya akses ke dashboard admin.",
          hint: { text: "Masuk ke halaman pengawas", href: "/masuk" },
        };
  }
  if (!account.active) return { ok: false, code: "inactive", error: "Akun ini dinonaktifkan. Hubungi admin." };
  if (role === "pengawas" && !account.roomId) {
    return { ok: false, code: "no-room", error: "Akun belum ditempatkan di ruangan. Hubungi admin." };
  }

  try {
    // Satu peran per perangkat: sesi baru menggantikan cookie sesi sebelumnya.
    await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
  } catch (error) {
    if (error instanceof APIError) return { ok: false, code: "wrong", error: "Email atau sandi salah." };
    throw error;
  }
  recordLoginAttempt({ email, role, success: true, ipAddress });
  purgeExpiredSessions();
  const room = account.roomId
    ? (db.select({ id: rooms.id, name: rooms.name }).from(rooms).where(eq(rooms.id, account.roomId)).get() ?? null)
    : null;
  return { ok: true, user: { id: account.id, name: account.name, role: account.role, roomId: account.roomId }, room };
}

/** Status HTTP untuk kegagalan login. */
export function loginFailureStatus(code: LoginFailure["code"]) {
  return { invalid: 422, wrong: 401, role: 403, inactive: 403, "no-room": 403, locked: 423 }[code];
}

/** Sesi login saat ini (pengguna aktif + ruangan + kedaluwarsa), atau null. */
export async function getCurrentSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const user = db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, roomId: users.roomId, active: users.active })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  if (!user?.active) return null;
  const room = user.roomId ? (db.select({ id: rooms.id, name: rooms.name, location: rooms.location }).from(rooms).where(eq(rooms.id, user.roomId)).get() ?? null) : null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, roomId: user.roomId },
    room,
    expiresAt: session.session.expiresAt.toISOString(),
  };
}

/**
 * Keluar: akhiri sesi login saat ini dan hapus cookie-nya (sesi kedaluwarsa
 * tetap dianggap berhasil keluar). `everywhere` juga mengakhiri semua sesi
 * akun itu di perangkat lain. Mengembalikan jumlah sesi lain yang diakhiri.
 */
export async function logout(headers: Headers, { everywhere = false } = {}) {
  let revoked = 0;
  if (everywhere) {
    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (session) revoked = revokeSessions(db, session.user.id) - 1;
  }
  await auth.api.signOut({ headers }).catch(() => undefined);
  return { revokedOthers: Math.max(0, revoked) };
}
