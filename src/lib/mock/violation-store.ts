// Penyimpanan pelanggaran lokal (memori proses server) untuk tahap frontend.
// Akan digantikan tabel `violations` saat backend pelanggaran dibuat.

import type { Violation } from "@/lib/violations";

const globalStore = globalThis as unknown as { localViolations?: Violation[] };
const store = (globalStore.localViolations ??= []);

export function addLocalViolation(violation: Violation) {
  store.push(violation);
}

export function listLocalViolations(roomId: string) {
  return store.filter((v) => v.roomId === roomId);
}
