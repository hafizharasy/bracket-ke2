import { hashPassword } from "better-auth/crypto";
import { and, count, eq, gt, lte } from "drizzle-orm";

import { db } from "@/db";
import { authAccounts, authSessions } from "@/db/schema";

export const MIN_PASSWORD_LENGTH = 8;

/** Hash sandi dengan algoritma Better Auth (scrypt), siap disimpan. */
export async function hashUserPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  return hashPassword(password);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Simpan hash sandi akun (kredensial "credential" Better Auth): buat bila
 * belum ada, ganti bila sudah. Panggil di dalam transaksi pembuatan/ubah akun.
 */
export function storePasswordHash(tx: Tx | typeof db, userId: string, hash: string) {
  const existing = tx
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "credential")))
    .get();
  if (existing) {
    tx.update(authAccounts).set({ password: hash, updatedAt: new Date() }).where(eq(authAccounts.id, existing.id)).run();
  } else {
    tx.insert(authAccounts)
      .values({ id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password: hash })
      .run();
  }
}

/** Akhiri semua sesi login akun (mis. setelah dinonaktifkan atau sandi direset). */
export function revokeSessions(tx: Tx | typeof db, userId: string) {
  return tx.delete(authSessions).where(eq(authSessions.userId, userId)).run().changes;
}

/** Jumlah sesi login yang masih berlaku per akun. */
export function activeSessionCounts(): Map<string, number> {
  const rows = db
    .select({ userId: authSessions.userId, n: count() })
    .from(authSessions)
    .where(gt(authSessions.expiresAt, new Date()))
    .groupBy(authSessions.userId)
    .all();
  return new Map(rows.map((r) => [r.userId, r.n]));
}

/** Bersihkan sesi yang sudah kedaluwarsa (dipanggil saat login berhasil). */
export function purgeExpiredSessions() {
  return db.delete(authSessions).where(lte(authSessions.expiresAt, new Date())).run().changes;
}
