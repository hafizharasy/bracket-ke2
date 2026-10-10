import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matchResultHistory, matchResults, rooms, users, violations } from "@/db/schema";
import { MIN_PASSWORD_LENGTH, hashUserPassword, revokeSessions, storePasswordHash } from "@/server/credentials";
import { ApiError } from "@/server/errors";

const password = z.string().min(MIN_PASSWORD_LENGTH, `Sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`).max(200);
export const pengawasCreateInput = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.email("Email tidak valid.").trim().toLowerCase(),
  roomId: z.string().min(1, "Pengawas wajib punya ruangan."),
  password,
});
export const pengawasUpdateInput = pengawasCreateInput.partial().extend({ active: z.boolean().optional() });
export type PengawasCreate = z.infer<typeof pengawasCreateInput>;
export type PengawasUpdate = z.infer<typeof pengawasUpdateInput>;

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  roomId: users.roomId,
  active: users.active,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Semua akun pengawas, urut email. */
export function listPengawas() {
  return db
    .select(columns)
    .from(users)
    .where(eq(users.role, "pengawas"))
    .orderBy(asc(users.email))
    .all()
    .map((u) => ({ ...u, lastLoginAt: iso(u.lastLoginAt), createdAt: iso(u.createdAt) }));
}

export function getPengawas(id: string) {
  return listPengawas().find((a) => a.id === id) ?? null;
}

function assertRoom(roomId: string) {
  if (!db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).get()) {
    throw new ApiError(422, "Ruangan tidak ditemukan.");
  }
}

function assertEmailFree(email: string, exceptId?: string) {
  const taken = db
    .select({ id: users.id })
    .from(users)
    .where(exceptId ? and(eq(users.email, email), ne(users.id, exceptId)) : eq(users.email, email))
    .get();
  if (taken) throw new ApiError(409, "Email sudah dipakai akun lain.");
}

/** Buat akun pengawas (aktif) beserta sandinya. */
export async function createPengawas(input: PengawasCreate) {
  assertRoom(input.roomId);
  assertEmailFree(input.email);
  const hash = await hashUserPassword(input.password);
  const id = `u-${crypto.randomUUID().slice(0, 8)}`;
  db.transaction((tx) => {
    tx.insert(users).values({ id, name: input.name, email: input.email, role: "pengawas", roomId: input.roomId }).run();
    storePasswordHash(tx, id, hash);
  });
  return getPengawas(id)!;
}

/**
 * Ubah akun pengawas. Pindah ruangan, ganti sandi, atau penonaktifan
 * mengakhiri semua sesi login akun itu (harus login ulang).
 */
export async function updatePengawas(id: string, input: PengawasUpdate) {
  const current = getPengawas(id);
  if (!current) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
  if (input.roomId) assertRoom(input.roomId);
  if (input.email) assertEmailFree(input.email, id);
  const hash = input.password ? await hashUserPassword(input.password) : null;
  const endSessions =
    !!hash || input.active === false || (input.roomId !== undefined && input.roomId !== current.roomId);

  db.transaction((tx) => {
    tx.update(users)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.roomId !== undefined && { roomId: input.roomId }),
        ...(input.active !== undefined && { active: input.active }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .run();
    if (hash) storePasswordHash(tx, id, hash);
    if (endSessions) revokeSessions(tx, id);
  });
  return getPengawas(id)!;
}

/**
 * Hapus akun pengawas yang belum pernah mencatat hasil/pelanggaran. Akun yang
 * sudah punya jejak tidak bisa dihapus (jejak audit) — nonaktifkan saja.
 */
export function deletePengawas(id: string) {
  if (!getPengawas(id)) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
  const used =
    db.select({ id: matchResults.id }).from(matchResults).where(eq(matchResults.recordedBy, id)).get() ??
    db.select({ id: matchResultHistory.id }).from(matchResultHistory).where(eq(matchResultHistory.recordedBy, id)).get() ??
    db.select({ id: violations.id }).from(violations).where(eq(violations.recordedBy, id)).get();
  if (used) throw new ApiError(409, "Akun sudah mencatat hasil/pelanggaran; nonaktifkan saja agar jejak audit tetap ada.");
  // Sesi & kredensial ikut terhapus (cascade).
  db.delete(users).where(eq(users.id, id)).run();
}
