import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { can, type RoomAction } from "@/lib/policy";
import { ApiError } from "@/server/errors";

export type SessionUser = Pick<typeof users.$inferSelect, "id" | "name" | "role" | "roomId">;

const sessionUserColumns = { id: users.id, name: users.name, role: users.role, roomId: users.roomId };

/** Akun aktif berdasarkan ID (peran & ruangan dibaca ulang dari database). */
function activeUser(id: string): SessionUser | null {
  return db.select(sessionUserColumns).from(users).where(and(eq(users.id, id), eq(users.active, true))).get() ?? null;
}

/** Pengguna dari cookie sesi Better Auth pada header request. */
async function userFromHeaders(headers: Headers): Promise<SessionUser | null> {
  const { auth } = await import("@/server/better-auth");
  const session = await auth.api.getSession({ headers });
  return session ? activeUser(session.user.id) : null;
}

/**
 * Pengguna yang sedang login untuk request API ini (cookie sesi Better Auth).
 * Akun nonaktif dianggap belum login.
 *
 * Khusus di luar production: header `x-dev-user-id` (ID akun di tabel users)
 * bisa dipakai untuk pengujian endpoint tanpa login.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const devId = process.env.NODE_ENV !== "production" ? request.headers.get("x-dev-user-id") : null;
  if (devId) return activeUser(devId);
  return userFromHeaders(request.headers);
}

/** Pengguna yang sedang bertindak di halaman (Server Action / Server Component). */
export async function getActingUser(): Promise<SessionUser | null> {
  const { headers } = await import("next/headers");
  return userFromHeaders(await headers());
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
