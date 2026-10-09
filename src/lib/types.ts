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
};

/** Kontrak data untuk GET /bracket. */
export type BracketData = {
  sessions: Session[];
  rooms: Room[];
  participants: Participant[];
  matches: Match[];
  /** Naik setiap ada perubahan hasil; klien live membandingkan angka ini. */
  version: number;
  updatedAt: string;
};
