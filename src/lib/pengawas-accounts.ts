import { connection } from "next/server";

export type PengawasAccount = {
  id: string;
  name: string;
  email: string;
  roomId: string | null;
  active: boolean;
  lastLoginAt: string | null;
  /** Sesi login yang masih berlaku (perangkat yang sedang masuk). */
  activeSessions: number;
};

/**
 * Daftar akun pengawas dari tabel users (role pengawas). Akun login selalu
 * dari database, juga saat BRACKET_DATA_SOURCE=mock.
 */
export async function getPengawasAccounts(): Promise<PengawasAccount[]> {
  // Status sesi login bergantung waktu sekarang → selalu dibaca saat request.
  await connection();
  const { listPengawas } = await import("@/server/pengawas-accounts");
  return listPengawas().map(({ id, name, email, roomId, active, lastLoginAt, activeSessions }) => ({
    id,
    name,
    email,
    roomId,
    active,
    lastLoginAt,
    activeSessions,
  }));
}
