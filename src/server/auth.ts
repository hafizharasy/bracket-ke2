import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { can, type RoomAction } from "@/lib/policy";
import { ApiError } from "@/server/errors";

export type SessionUser = Pick<typeof users.$inferSelect, "id" | "name" | "role" | "roomId">;

/**
 * Pengguna yang sedang login untuk request ini.
 *
 * SEMENTARA, sampai login (Better Auth) dibuat: di luar production, pengguna
 * dibaca dari header `x-dev-user-id` (ID akun di tabel users) untuk pengujian,
 * atau dari sesi stub pengawas (untuk panggilan dari browser).
 * Di production selalu null → semua endpoint tulis menolak dengan 401.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  if (process.env.NODE_ENV === "production") return null;
  const id = request.headers.get("x-dev-user-id");
  if (!id) return getActingUser();
  const user = db
    .select({ id: users.id, name: users.name, role: users.role, roomId: users.roomId })
    .from(users)
    .where(eq(users.id, id))
    .get();
  return user ?? null;
}

/**
 * Pengguna yang sedang bertindak di halaman (Server Action / Server Component).
 *
 * SEMENTARA, sampai login (Better Auth) dibuat: di luar production memakai
 * akun dari sesi stub pengawas (getPengawasSession). Di production selalu
 * null → semua aksi tulis ditolak.
 */
export async function getActingUser(): Promise<SessionUser | null> {
  if (process.env.NODE_ENV === "production") return null;
  const { getPengawasSession } = await import("@/lib/pengawas-session");
  const session = await getPengawasSession();
  if (!session) return null;
  const user = db
    .select({ id: users.id, name: users.name, role: users.role, roomId: users.roomId })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();
  return user ?? null;
}

export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new ApiError(401, "Silakan login terlebih dahulu.");
  return user;
}

/** Tolak (403) bila pengguna tidak boleh melakukan aksi di ruangan ini — lihat lib/policy. */
export function authorize(user: SessionUser, action: RoomAction, resource: { roomId: string }) {
  if (!can(user, action, resource)) {
    throw new ApiError(403, "Anda tidak punya akses ke ruangan ini.");
  }
}
