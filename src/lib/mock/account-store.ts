// State tiruan akun pengawas (memori proses server) untuk tahap frontend:
// perubahan dari form admin ditimpakan di atas daftar dasar.
// Sandi TIDAK disimpan di sini; penyimpanan sandi menyusul di backend login.

import type { PengawasAccount } from "@/lib/pengawas-accounts";

type Overlay = { changes: Map<string, Partial<PengawasAccount>>; created: PengawasAccount[] };

const globalStore = globalThis as unknown as { mockAccountOverlay?: Overlay };
const overlay: Overlay = (globalStore.mockAccountOverlay ??= { changes: new Map(), created: [] as PengawasAccount[] });

export function applyAccountOverlay(base: PengawasAccount[]): PengawasAccount[] {
  return [...base, ...overlay.created].map((a) => ({ ...a, ...overlay.changes.get(a.id) }));
}

export function createMockAccount(account: Omit<PengawasAccount, "id" | "lastLoginAt">) {
  const created = { ...account, id: `u-${crypto.randomUUID().slice(0, 8)}`, lastLoginAt: null };
  overlay.created.push(created);
  return created;
}

export function updateMockAccount(id: string, change: Partial<PengawasAccount>) {
  overlay.changes.set(id, { ...overlay.changes.get(id), ...change });
}
