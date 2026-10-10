import { connection } from "next/server";

export type PengawasSession = {
  userId: string;
  name: string;
  /** Pengawas hanya bisa mengakses ruangan ini. */
  roomId: string;
};

/**
 * Sesi pengawas yang sedang login.
 *
 * SEMENTARA (stub frontend): selalu pengawas Ruangan 1. Akan diganti sesi
 * Better Auth pada fitur Login Ruangan, dengan bentuk data yang sama.
 */
export async function getPengawasSession(): Promise<PengawasSession> {
  await connection();
  return { userId: "u-pengawas-1", name: "Pengawas Ruangan 1", roomId: "ruangan-1" };
}

/** Satu-satunya aturan akses pengawas: hanya ruangan miliknya. */
export function canAccessRoom(session: PengawasSession, roomId: string) {
  return session.roomId === roomId;
}
