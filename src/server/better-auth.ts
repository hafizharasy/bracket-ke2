import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { authAccounts, authSessions, authVerifications, users } from "@/db/schema";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.BETTER_AUTH_SECRET) {
  console.warn("[auth] BETTER_AUTH_SECRET belum diatur; login tidak aman di production.");
}

/**
 * Better Auth: login email + sandi untuk admin utama & pengawas ruangan.
 * Pendaftaran publik dimatikan — akun dibuat admin (atau skrip
 * db:create-admin). Peran, ruangan, dan status aktif disimpan di tabel users.
 */
export const auth = betterAuth({
  appName: "Bracket LRP 2026",
  secret: process.env.BETTER_AUTH_SECRET ?? (isProduction ? undefined : "dev-only-secret-bracket-lrp-2026-ganti-di-production"),
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { users, auth_sessions: authSessions, auth_accounts: authAccounts, auth_verifications: authVerifications },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  user: {
    modelName: "users",
    additionalFields: {
      role: { type: "string", required: true, input: false },
      roomId: { type: "string", required: false, input: false },
      active: { type: "boolean", required: false, input: false, defaultValue: true },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    modelName: "auth_sessions",
    // Satu hari turnamen + cadangan; diperpanjang otomatis saat dipakai.
    expiresIn: 60 * 60 * 24,
    updateAge: 60 * 60,
  },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  databaseHooks: {
    session: {
      create: {
        // Akun nonaktif tidak boleh mendapat sesi baru.
        before: async (session) => {
          const user = db.select({ active: users.active }).from(users).where(eq(users.id, session.userId)).get();
          return !!user?.active;
        },
        after: async (session) => {
          db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, session.userId)).run();
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
