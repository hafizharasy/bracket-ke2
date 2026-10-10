// State tiruan perubahan ruangan & sesi (memori proses server) untuk tahap
// frontend. Ditimpakan pada data bagan di getBracket().

import type { BracketData, Room, Session } from "@/lib/types";

type Store = { rooms: Map<string, Partial<Room>>; sessions: Map<string, Partial<Session>> };

const globalStore = globalThis as unknown as { mockStructureOverlay?: Store };
const store: Store = (globalStore.mockStructureOverlay ??= { rooms: new Map(), sessions: new Map() });

export function updateMockRoom(id: string, change: Partial<Room>) {
  store.rooms.set(id, { ...store.rooms.get(id), ...change });
}

export function updateMockSession(id: string, change: Partial<Session>) {
  store.sessions.set(id, { ...store.sessions.get(id), ...change });
}

export function applyStructureOverlay(data: BracketData): BracketData {
  if (store.rooms.size === 0 && store.sessions.size === 0) return data;
  return {
    ...data,
    rooms: data.rooms.map((r) => ({ ...r, ...store.rooms.get(r.id) })),
    sessions: data.sessions.map((s) => ({ ...s, ...store.sessions.get(s.id) })),
  };
}
