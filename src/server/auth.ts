import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/server/errors";

export type SessionUser = Pick<typeof users.$inferSelect, "id" | "name" | "role" | "roomId">;

/**
 * Pengguna yang sedang login untuk request ini.
 *
 * SEMENTARA, sampai login (Better Auth) dibuat: di luar production, pengguna
 * dibaca dari header `x-dev-user-id` (ID akun di tabel users) untuk pengujian.
 * Di production selalu null → semua endpoint tulis menolak dengan 401.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  if (process.env.NODE_ENV === "production") return null;
  const id = request.headers.get("x-dev-user-id");
  if (!id) return null;
  const user = db
    .select({ id: users.id, name: users.name, role: users.role, roomId: users.roomId })
    .from(users)
    .where(eq(users.id, id))
    .get();
  return user ?? null;
}

export async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new ApiError(401, "Silakan login terlebih dahulu.");
  return user;
}

/** Admin boleh semua ruangan; pengawas hanya ruangannya sendiri. */
export function assertRoomAccess(user: SessionUser, roomId: string) {
  if (user.role === "admin") return;
  if (user.role === "pengawas" && user.roomId === roomId) return;
  throw new ApiError(403, "Anda tidak punya akses ke ruangan ini.");
}
