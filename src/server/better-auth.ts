import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { authAccounts, authSessions, authVerifications, users } from "@/db/schema";

const isProduction = process.env.NODE_ENV === "production";
/** Sedang `next build`: modul dimuat untuk mengumpulkan data halaman, belum melayani login. */
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

if (isProduction && !isBuild && !process.env.BETTER_AUTH_SECRET) {
  console.warn("[auth] BETTER_AUTH_SECRET belum diatur; login tidak aman di production.");
}

/**
 * Better Auth: login email + sandi untuk admin utama & pengawas ruangan.
 * Pendaftaran publik dimatikan — akun dibuat admin (atau skrip
 * db:create-admin). Peran, ruangan, dan status aktif disimpan di tabel users.
 */
export const auth = betterAuth({
  appName: "Bracket LRP 2026",
  // Saat runtime production, scripts/start.mjs menolak berjalan tanpa BETTER_AUTH_SECRET.
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (isProduction && !isBuild ? undefined : "dev-only-secret-bracket-lrp-2026-ganti-di-production"),
  // URL publik; di Railway otomatis dari domain layanan bila BETTER_AUTH_URL kosong.
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined),
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { users, auth_sessions: authSessions, auth_accounts: authAccounts, auth_verifications: authVerifications },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  // Login hanya lewat aksi/endpoint aplikasi (cek peran, status, & penguncian
  // tebakan sandi); profil & sandi hanya diubah admin. Rute HTTP bawaan ini
  // dimatikan — pemanggilan auth.api.* dari server tetap berjalan.
  disabledPaths: [
    "/sign-in/email",
    "/sign-up/email",
    "/update-user",
    "/change-email",
    "/change-password",
    "/delete-user",
    "/request-password-reset",
    "/reset-password",
    "/set-password",
  ],
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
