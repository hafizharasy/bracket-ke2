import type { Match } from "@/lib/types";

/** Kelompok laga di halaman pengawas, urut sesuai prioritas kerja. */
export const ROOM_MATCH_GROUPS = [
  { key: "ongoing", title: "Sedang berlangsung", empty: "Tidak ada laga yang sedang berjalan." },
  { key: "ready", title: "Siap dimainkan", empty: "Belum ada laga dengan peserta lengkap." },
  { key: "waiting", title: "Menunggu peserta", empty: "Semua laga sudah punya peserta." },
  { key: "done", title: "Selesai", empty: "Belum ada hasil yang diinput." },
] as const;

export type RoomMatchGroup = (typeof ROOM_MATCH_GROUPS)[number]["key"];

export function roomMatchGroup(match: Match): RoomMatchGroup {
  if (match.status === "done") return "done";
  if (match.status === "ongoing") return "ongoing";
  return match.participantAId && match.participantBId ? "ready" : "waiting";
}

/** Laga yang hasilnya boleh diinput pengawas: kedua peserta sudah ada. */
export function canInputResult(match: Match) {
  return !!match.participantAId && !!match.participantBId;
}
