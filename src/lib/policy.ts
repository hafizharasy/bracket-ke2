// Aturan otorisasi tunggal untuk seluruh aplikasi.
//   admin    → boleh semua aksi di semua ruangan.
//   pengawas → hanya aksi ruangan, dan hanya di ruangan miliknya.
// Peran/aksi lain atau pengawas tanpa ruangan → ditolak.

export type Actor = { role: "admin" | "pengawas"; roomId: string | null };

/** Aksi yang terikat ke satu ruangan. */
export const ROOM_ACTIONS = [
  "room:view", // lihat laga, riwayat, pelanggaran ruangan
  "result:write", // input/koreksi hasil
  "result:cancel", // batalkan hasil
  "proof:upload", // unggah foto bukti
  "violation:write", // catat pelanggaran
] as const;
/** Aksi khusus admin utama. */
export const ADMIN_ACTIONS = ["tournament:manage", "accounts:manage"] as const;

export type RoomAction = (typeof ROOM_ACTIONS)[number];
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export function can(actor: Actor | null | undefined, action: RoomAction, resource: { roomId: string }): boolean;
export function can(actor: Actor | null | undefined, action: AdminAction): boolean;
export function can(
  actor: Actor | null | undefined,
  action: RoomAction | AdminAction,
  resource?: { roomId: string },
) {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "pengawas" || !actor.roomId) return false;
  if (!(ROOM_ACTIONS as readonly string[]).includes(action) || !resource) return false;
  return actor.roomId === resource.roomId;
}
