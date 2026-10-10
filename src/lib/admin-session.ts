import { connection } from "next/server";

export type AdminSession = { userId: string; name: string };

/**
 * Sesi admin utama yang sedang login.
 *
 * SEMENTARA (stub frontend): selalu akun admin contoh. Akan diganti sesi
 * Better Auth pada fitur Login Admin Utama, dengan bentuk data yang sama.
 */
export async function getAdminSession(): Promise<AdminSession> {
  await connection();
  return { userId: "u-admin", name: "Admin Utama" };
}
