import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
 * Sesi pengawas yang sedang login, atau null.
 *
 * SEMENTARA (stub frontend): akun dari cookie login stub (lrp_stub_user)
 * yang masih aktif & punya ruangan. Di production selalu null sampai login
 * Better Auth dibuat, dengan bentuk data yang sama.
 */
export async function getPengawasSession(): Promise<PengawasSession | null> {
  await connection();
  const userId = (await cookies()).get(STUB_USER_COOKIE)?.value;
  if (process.env.NODE_ENV === "production" || !userId) return null;
  const { getPengawasAccounts } = await import("@/lib/pengawas-accounts");
  const account = (await getPengawasAccounts()).find((a) => a.id === userId && a.active && a.roomId);
  return account ? { userId: account.id, name: account.name, roomId: account.roomId! } : null;
}

/** Halaman pengawas: arahkan ke /masuk (kembali ke `next` setelah login) bila belum login. */
export async function requirePengawas(next = "/ruangan"): Promise<PengawasSession> {
  const session = await getPengawasSession();
  if (!session) redirect(`/masuk?next=${encodeURIComponent(next)}`);
  return session;
}

/** Hanya izinkan `next` berupa path area pengawas (mencegah open redirect). */
export function safeNext(next: string | null | undefined) {
  return next && /^\/ruangan([/?][\w\-/?=&%.]*)?$/.test(next) && !next.startsWith("//") ? next : "/ruangan";
}

/** Boleh melihat/mengelola ruangan ini? (aturan di lib/policy, peran pengawas). */
export function canAccessRoom(session: PengawasSession, roomId: string) {
  return can({ role: "pengawas", roomId: session.roomId }, "room:view", { roomId });
}
