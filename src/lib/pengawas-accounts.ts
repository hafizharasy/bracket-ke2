import { getBracket } from "@/lib/get-bracket";
import { bracketSource } from "@/server/live";

export type PengawasAccount = {
  id: string;
  name: string;
  email: string;
  roomId: string | null;
  active: boolean;
  lastLoginAt: string | null;
};

/**
 * Daftar akun pengawas. Dari tabel users (role pengawas); saat
 * BRACKET_DATA_SOURCE=mock memakai contoh satu akun per ruangan.
 * Status aktif & login terakhir menyusul di backend (sementara: aktif, null).
 */
export async function getPengawasAccounts(): Promise<PengawasAccount[]> {
  // Perubahan dari form admin (state tiruan) ditimpakan di atas daftar dasar.
  const { applyAccountOverlay } = await import("@/lib/mock/account-store");
  return applyAccountOverlay(await getBaseAccounts());
}

async function getBaseAccounts(): Promise<PengawasAccount[]> {
  if (bracketSource() === "db") {
    const [{ db }, { users }, { asc, eq }] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
    return db
      .select({ id: users.id, name: users.name, email: users.email, roomId: users.roomId })
      .from(users)
      .where(eq(users.role, "pengawas"))
      .orderBy(asc(users.email))
      .all()
      .map((u) => ({ ...u, active: true, lastLoginAt: null }));
  }
  const { rooms } = await getBracket();
  return rooms.map((room, i) => ({
    id: `u-pengawas-${i + 1}`,
    name: `Pengawas ${room.name}`,
    email: `ruangan${i + 1}@lrp.local`,
    roomId: room.id,
    active: i !== 9,
    lastLoginAt: i < 6 ? new Date(Date.now() - (i + 1) * 17 * 60_000).toISOString() : null,
  }));
}
