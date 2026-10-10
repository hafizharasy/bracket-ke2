// Pelanggaran peserta — tipe & daftar jenis (selaras tabel `violations`).

export const VIOLATION_TYPES = [
  "Terlambat hadir",
  "Tidak hadir (WO)",
  "Perilaku tidak sportif",
  "Melanggar aturan permainan",
  "Memakai perangkat/alat terlarang",
  "Lainnya",
] as const;

export type ViolationType = (typeof VIOLATION_TYPES)[number];

export type Violation = {
  id: string;
  participantId: string;
  matchId: string | null;
  roomId: string;
  type: string;
  note: string | null;
  /** ISO. */
  occurredAt: string;
  recordedBy: string;
};
