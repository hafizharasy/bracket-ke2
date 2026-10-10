import { cookies } from "next/headers";
import { connection } from "next/server";

import { can } from "@/lib/policy";

export type PengawasSession = {
  userId: string;
  name: string;
  /** Pengawas hanya bisa mengakses ruangan ini. */
  roomId: string;
};

/** Cookie pengembangan berisi ID akun pengawas yang "login" lewat login stub. */
export const STUB_USER_COOKIE = "lrp_stub_user";

/**
 * Sesi pengawas yang sedang login.
 *
 * SEMENTARA (stub frontend): akun dari cookie login stub (lrp_stub_user),
 * atau pengawas Ruangan 1 bila belum login. Akan diganti sesi Better Auth
 * pada fitur Login Ruangan, dengan bentuk data yang sama.
 */
export async function getPengawasSession(): Promise<PengawasSession> {
  await connection();
  const userId = (await cookies()).get(STUB_USER_COOKIE)?.value;
  if (userId) {
    const { getPengawasAccounts } = await import("@/lib/pengawas-accounts");
    const account = (await getPengawasAccounts()).find((a) => a.id === userId && a.active && a.roomId);
    if (account) return { userId: account.id, name: account.name, roomId: account.roomId! };
  }
  return { userId: "u-pengawas-1", name: "Pengawas Ruangan 1", roomId: "ruangan-1" };
}

/** Boleh melihat/mengelola ruangan ini? (aturan di lib/policy, peran pengawas). */
export function canAccessRoom(session: PengawasSession, roomId: string) {
  return can({ role: "pengawas", roomId: session.roomId }, "room:view", { roomId });
}
