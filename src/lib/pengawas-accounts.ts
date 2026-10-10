export type PengawasAccount = {
  id: string;
  name: string;
  email: string;
  roomId: string | null;
  active: boolean;
  lastLoginAt: string | null;
};

/**
 * Daftar akun pengawas dari tabel users (role pengawas). Akun login selalu
 * dari database, juga saat BRACKET_DATA_SOURCE=mock.
 */
export async function getPengawasAccounts(): Promise<PengawasAccount[]> {
  const { listPengawas } = await import("@/server/pengawas-accounts");
  return listPengawas().map(({ id, name, email, roomId, active, lastLoginAt }) => ({ id, name, email, roomId, active, lastLoginAt }));
}
