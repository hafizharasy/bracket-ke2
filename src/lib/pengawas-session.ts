import { redirect } from "next/navigation";
import { connection } from "next/server";

import { can } from "@/lib/policy";

export type PengawasSession = {
  userId: string;
  name: string;
  /** Pengawas hanya bisa mengakses ruangan ini. */
  roomId: string;
};

/** Ada cookie sesi Better Auth (sah atau tidak) di request ini? */
export async function hasSessionCookie() {
  const [{ headers }, { getSessionCookie }] = await Promise.all([import("next/headers"), import("better-auth/cookies")]);
  return !!getSessionCookie(await headers());
}

/**
 * Sesi pengawas yang sedang login (Better Auth), atau null bila belum login,
 * bukan pengawas, akun nonaktif, atau belum punya ruangan.
 */
export async function getPengawasSession(): Promise<PengawasSession | null> {
  await connection();
  const { getActingUser } = await import("@/server/auth");
  const user = await getActingUser();
  if (!user || user.role !== "pengawas" || !user.roomId) return null;
  return { userId: user.id, name: user.name, roomId: user.roomId };
}

/** Halaman pengawas: arahkan ke /masuk (kembali ke `next` setelah login) bila belum login. */
export async function requirePengawas(next = "/ruangan"): Promise<PengawasSession> {
  const session = await getPengawasSession();
  if (!session) {
    // Cookie ada tapi tidak sah lagi (kedaluwarsa / akun dinonaktifkan / dipindah) → sesi berakhir.
    const hadCookie = await hasSessionCookie();
    redirect(`/masuk?next=${encodeURIComponent(next)}${hadCookie ? "&alasan=sesi" : ""}`);
  }
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
