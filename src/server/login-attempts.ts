import { and, desc, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db";
import { loginAttempts, USER_ROLES } from "@/db/schema";

/** Batas gagal berturut-turut per email sebelum dikunci sementara. */
export const MAX_FAILED_ATTEMPTS = 5;
/** Jendela hitung gagal sekaligus lama penguncian. */
export const LOCKOUT_MINUTES = 15;
/** Jejak lebih tua dari ini dibersihkan saat mencatat percobaan baru. */
const RETENTION_DAYS = 30;

type Role = (typeof USER_ROLES)[number];

/** Catat satu percobaan login (berhasil / gagal). */
export function recordLoginAttempt(attempt: { email: string; role: Role; success: boolean; ipAddress?: string | null }) {
  db.insert(loginAttempts)
    .values({ email: attempt.email.toLowerCase(), role: attempt.role, success: attempt.success, ipAddress: attempt.ipAddress ?? null })
    .run();
  db.delete(loginAttempts)
    .where(lt(loginAttempts.createdAt, new Date(Date.now() - RETENTION_DAYS * 86_400_000)))
    .run();
}

/**
 * Status penguncian email: dikunci bila ada ≥ MAX_FAILED_ATTEMPTS gagal
 * berturut-turut (sejak login berhasil terakhir) dalam LOCKOUT_MINUTES
 * terakhir. `retryAt` = kapan boleh mencoba lagi.
 */
export function getLockout(email: string, now = new Date()) {
  const since = new Date(now.getTime() - LOCKOUT_MINUTES * 60_000);
  const recent = db
    .select({ success: loginAttempts.success, createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email.toLowerCase()), gt(loginAttempts.createdAt, since)))
    .orderBy(desc(loginAttempts.createdAt), desc(loginAttempts.id))
    .all();
  const lastSuccess = recent.findIndex((a) => a.success);
  const failures = lastSuccess === -1 ? recent : recent.slice(0, lastSuccess);
  if (failures.length < MAX_FAILED_ATTEMPTS) {
    return { locked: false as const, remaining: MAX_FAILED_ATTEMPTS - failures.length };
  }
  // Kunci berakhir LOCKOUT_MINUTES setelah kegagalan ke-MAX (yang terakhir menggenapi batas).
  const trigger = failures[failures.length - MAX_FAILED_ATTEMPTS] ?? failures[0];
  return { locked: true as const, retryAt: new Date(trigger.createdAt.getTime() + LOCKOUT_MINUTES * 60_000) };
}
