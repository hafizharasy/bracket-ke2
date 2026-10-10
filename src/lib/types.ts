// Tipe domain — mengikuti skema database di PRD (versi camelCase).

export type Session = {
  id: string;
  name: string;
  orderIndex: number;
  startTime: string | null;
};

export type Room = {
  id: string;
  name: string;
  location: string | null;
};

export type Participant = {
  id: string;
  name: string;
  /** Asal sekolah peserta (kolom lama `team_or_club`). */
  teamOrClub: string | null;
  sessionId: string | null;
  roomId: string | null;
};

export type MatchStatus = "scheduled" | "ongoing" | "done";

export type Match = {
  id: string;
  round: number;
  matchNumber: number;
  sessionId: string;
  roomId: string;
  participantAId: string | null;
  participantBId: string | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  nextMatchId: string | null;
  scheduledAt: string | null;
  /** Final round-robin: slot A/B diisi pemenang laga ini (semifinal). */
  feedAId?: string | null;
  feedBId?: string | null;
  /** Final round-robin: jenis kemenangan (menentukan poin), lihat WIN_TYPES. */
  winType?: string | null;
};

/** Ruangan yang dipakai pada suatu sesi (tiap pasangan = satu bagan ruangan). */
export type SessionRoom = { sessionId: string; roomId: string };

/** Kontrak data untuk GET /bracket. */
export type BracketData = {
  sessions: Session[];
  rooms: Room[];
  /** Ruangan aktif per sesi (bisa berbeda tiap sesi). */
  sessionRooms: SessionRoom[];
  participants: Participant[];
  matches: Match[];
  /** Naik setiap ada perubahan hasil; klien live membandingkan angka ini. */
  version: number;
  updatedAt: string;
};
