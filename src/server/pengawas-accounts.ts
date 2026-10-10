import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matchResultHistory, matchResults, rooms, users, violations } from "@/db/schema";
import {
  activeSessionCounts,
  hashUserPassword,
  MIN_PASSWORD_LENGTH,
  revokeSessions,
  storePasswordHash,
} from "@/server/credentials";
import { recordAudit } from "@/server/audit";
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

/** Semua akun pengawas, urut email, beserta jumlah sesi login yang masih berlaku. */
export function listPengawas() {
  const sessionsByUser = activeSessionCounts();
  return db
    .select(columns)
    .from(users)
    .where(eq(users.role, "pengawas"))
    .orderBy(asc(users.email))
    .all()
    .map((u) => ({
      ...u,
      lastLoginAt: iso(u.lastLoginAt),
      createdAt: iso(u.createdAt),
      activeSessions: sessionsByUser.get(u.id) ?? 0,
    }));
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

/** Admin yang melakukan perubahan (untuk audit_logs); null = skrip/sistem. */
type Actor = string | null;

const roomName = (roomId: string | null) =>
  roomId ? (db.select({ name: rooms.name }).from(rooms).where(eq(rooms.id, roomId)).get()?.name ?? roomId) : "—";

/** Buat akun pengawas (aktif) beserta sandinya. */
export async function createPengawas(input: PengawasCreate, actorId: Actor = null) {
  assertRoom(input.roomId);
  assertEmailFree(input.email);
  const hash = await hashUserPassword(input.password);
  const id = `u-${crypto.randomUUID().slice(0, 8)}`;
  db.transaction((tx) => {
    tx.insert(users).values({ id, name: input.name, email: input.email, role: "pengawas", roomId: input.roomId }).run();
    storePasswordHash(tx, id, hash);
    recordAudit(
      { actorId, action: "account.create", entity: "user", entityId: id, summary: `Akun pengawas ${input.email} (${roomName(input.roomId)}) dibuat` },
      tx,
    );
  });
  return getPengawas(id)!;
}

/**
 * Ubah akun pengawas. Pindah ruangan, ganti sandi, atau penonaktifan
 * mengakhiri semua sesi login akun itu (harus login ulang).
 */
export async function updatePengawas(id: string, input: PengawasUpdate, actorId: Actor = null) {
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
    const changes = [
      input.name !== undefined && input.name !== current.name && `nama → ${input.name}`,
      input.email !== undefined && input.email !== current.email && `email → ${input.email}`,
      input.roomId !== undefined && input.roomId !== current.roomId && `ruangan → ${roomName(input.roomId)}`,
      input.active !== undefined && input.active !== current.active && (input.active ? "diaktifkan" : "dinonaktifkan"),
      hash && "sandi diatur ulang",
    ].filter(Boolean);
    if (changes.length) {
      const action = input.active === false ? "account.deactivate" : hash ? "account.reset-password" : "account.update";
      recordAudit({ actorId, action, entity: "user", entityId: id, summary: `${current.email}: ${changes.join(", ")}` }, tx);
    }
  });
  return getPengawas(id)!;
}

/**
 * Hapus akun pengawas yang belum pernah mencatat hasil/pelanggaran. Akun yang
 * sudah punya jejak tidak bisa dihapus (jejak audit) — nonaktifkan saja.
 */
export function deletePengawas(id: string, actorId: Actor = null) {
  const account = getPengawas(id);
  if (!account) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
  const used =
    db.select({ id: matchResults.id }).from(matchResults).where(eq(matchResults.recordedBy, id)).get() ??
    db.select({ id: matchResultHistory.id }).from(matchResultHistory).where(eq(matchResultHistory.recordedBy, id)).get() ??
    db.select({ id: violations.id }).from(violations).where(eq(violations.recordedBy, id)).get();
  if (used) throw new ApiError(409, "Akun sudah mencatat hasil/pelanggaran; nonaktifkan saja agar jejak audit tetap ada.");
  db.transaction((tx) => {
    // Sesi & kredensial ikut terhapus (cascade).
    tx.delete(users).where(eq(users.id, id)).run();
    recordAudit({ actorId, action: "account.delete", entity: "user", entityId: id, summary: `Akun pengawas ${account.email} dihapus` }, tx);
  });
}

/** Keluarkan akun pengawas dari semua perangkat (akhiri semua sesi login). */
export function logoutPengawasEverywhere(id: string, actorId: Actor = null) {
  const account = getPengawas(id);
  if (!account) throw new ApiError(404, "Akun pengawas tidak ditemukan.");
  const revoked = revokeSessions(db, id);
  recordAudit({ actorId, action: "account.logout", entity: "user", entityId: id, summary: `${account.email} dikeluarkan dari ${revoked} perangkat` });
  return { revoked };
}

/**
 * Buat akun untuk setiap ruangan yang belum punya pengawas aktif, dengan
 * sandi acak. Mengembalikan kredensialnya SEKALI (sandi tidak bisa dibaca
 * lagi) untuk dibagikan ke pengawas. Email: ruangan-<n>@<domain>.
 */
export async function generateMissingPengawas(domain: string, actorId: Actor = null) {
  const covered = new Set(listPengawas().filter((a) => a.active && a.roomId).map((a) => a.roomId));
  const missing = db
    .select({ id: rooms.id, name: rooms.name })
    .from(rooms)
    .all()
    .filter((r) => !covered.has(r.id))
    .sort((a, b) => a.id.localeCompare(b.id, "id", { numeric: true }));
  const created: { id: string; name: string; email: string; roomId: string; roomName: string; password: string }[] = [];
  for (const room of missing) {
    const base = room.id.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    let email = `${base}@${domain}`;
    for (let n = 2; db.select({ id: users.id }).from(users).where(eq(users.email, email)).get(); n++) email = `${base}-${n}@${domain}`;
    const password = randomPassword();
    const account = await createPengawas({ name: `Pengawas ${room.name}`, email, roomId: room.id, password }, actorId);
    created.push({ id: account.id, name: account.name, email, roomId: room.id, roomName: room.name, password });
  }
  return created;
}

/** Sandi acak 12 karakter tanpa huruf mirip (0/O, 1/l). */
function randomPassword(length = 12) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(length)), (n) => chars[n % chars.length]).join("");
}
