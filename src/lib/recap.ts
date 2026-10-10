// Rekap & Ekspor — bentuk data (kontrak) dan fungsi murni penyusunnya.

import { LAST_ROOM_ROUND, roundLabel, sortMatches } from "@/lib/bracket";
import type { BracketData, MatchStatus } from "@/lib/types";
import type { Violation } from "@/lib/violations";

/** Filter rekap dari URL: ID sesi / ruangan (kosong = semua). */
export type RecapFilters = { sesi?: string; ruangan?: string };

export type ResultRecapRow = {
  matchId: string;
  sessionId: string;
  sessionName: string;
  roomId: string;
  roomName: string;
  round: number;
  roundLabel: string;
  matchNumber: number;
  status: MatchStatus;
  scheduledAt: string | null;
  participantA: { id: string; name: string } | null;
  participantB: { id: string; name: string } | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: { id: string; name: string } | null;
  /** Waktu hasil dicatat & pencatat (null bila belum ada hasil). */
  recordedAt: string | null;
  recordedBy: string | null;
  /** Berapa kali hasil dikoreksi. */
  corrections: number;
  hasProof: boolean;
};

export type ViolationRecapRow = {
  id: string;
  occurredAt: string;
  participant: { id: string; name: string };
  sessionName: string | null;
  roomId: string;
  roomName: string;
  matchLabel: string | null;
  type: string;
  note: string | null;
  recordedBy: string;
};

export type RecapSummary = {
  matches: { total: number; done: number; ongoing: number; scheduled: number; percent: number };
  corrections: number;
  roomChampions: { sessionName: string; roomName: string; champion: string | null }[];
  champion: string | null;
  violations: { total: number; participants: number; byType: { type: string; count: number }[] };
};

export type RecapData = {
  filters: RecapFilters;
  sessions: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  results: ResultRecapRow[];
  violations: ViolationRecapRow[];
  summary: RecapSummary;
  generatedAt: string;
};

/** Info tambahan hasil per laga (pencatat, koreksi, bukti) di luar data bagan. */
export type ResultMeta = { recordedAt: string | null; recordedBy: string | null; corrections: number; hasProof: boolean };

/** Susun rekap dari data bagan + pelanggaran (fungsi murni). */
export function buildRecap(
  data: Pick<BracketData, "sessions" | "rooms" | "participants" | "matches">,
  violations: Violation[],
  filters: RecapFilters,
  meta: Map<string, ResultMeta> = new Map(),
  now = new Date(),
): RecapData {
  const people = new Map(data.participants.map((p) => [p.id, p]));
  const sessions = new Map(data.sessions.map((s) => [s.id, s]));
  const rooms = new Map(data.rooms.map((r) => [r.id, r]));
  const person = (id: string | null) => {
    const p = id ? people.get(id) : undefined;
    return p ? { id: p.id, name: p.name } : null;
  };
  const inScope = (m: { sessionId: string; roomId: string }) =>
    (!filters.sesi || m.sessionId === filters.sesi) && (!filters.ruangan || m.roomId === filters.ruangan);

  const matches = data.matches.filter(inScope);
  const results: ResultRecapRow[] = matches
    .slice()
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId, "id", { numeric: true }) || a.roomId.localeCompare(b.roomId, "id", { numeric: true }) || sortMatches(a, b))
    .map((m) => {
      const extra = meta.get(m.id);
      return {
        matchId: m.id,
        sessionId: m.sessionId,
        sessionName: sessions.get(m.sessionId)?.name ?? m.sessionId,
        roomId: m.roomId,
        roomName: rooms.get(m.roomId)?.name ?? m.roomId,
        round: m.round,
        roundLabel: roundLabel(m.round),
        matchNumber: m.matchNumber,
        status: m.status,
        scheduledAt: m.scheduledAt,
        participantA: person(m.participantAId),
        participantB: person(m.participantBId),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winner: person(m.winnerId),
        recordedAt: extra?.recordedAt ?? null,
        recordedBy: extra?.recordedBy ?? null,
        corrections: extra?.corrections ?? 0,
        hasProof: extra?.hasProof ?? false,
      };
    });

  const matchById = new Map(data.matches.map((m) => [m.id, m]));
  const violationRows: ViolationRecapRow[] = violations
    .filter((v) => {
      const match = v.matchId ? matchById.get(v.matchId) : undefined;
      const sessionId = match?.sessionId ?? people.get(v.participantId)?.sessionId ?? null;
      return (!filters.ruangan || v.roomId === filters.ruangan) && (!filters.sesi || sessionId === filters.sesi);
    })
    .map((v) => {
      const match = v.matchId ? matchById.get(v.matchId) : undefined;
      const sessionId = match?.sessionId ?? people.get(v.participantId)?.sessionId ?? null;
      return {
        id: v.id,
        occurredAt: v.occurredAt,
        participant: person(v.participantId) ?? { id: v.participantId, name: v.participantId },
        sessionName: sessionId ? (sessions.get(sessionId)?.name ?? null) : null,
        roomId: v.roomId,
        roomName: rooms.get(v.roomId)?.name ?? v.roomId,
        matchLabel: match ? `${roundLabel(match.round)} #${match.matchNumber}` : null,
        type: v.type,
        note: v.note,
        recordedBy: v.recordedBy,
      };
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const count = (status: MatchStatus) => matches.filter((m) => m.status === status).length;
  const done = count("done");
  const byType = new Map<string, number>();
  for (const v of violationRows) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
  const final = data.matches.reduce<(typeof data.matches)[number] | undefined>((top, m) => (!top || m.round > top.round ? m : top), undefined);

  return {
    filters,
    sessions: data.sessions.map((s) => ({ id: s.id, name: s.name })),
    rooms: data.rooms.map((r) => ({ id: r.id, name: r.name })),
    results,
    violations: violationRows,
    summary: {
      matches: {
        total: matches.length,
        done,
        ongoing: count("ongoing"),
        scheduled: count("scheduled"),
        percent: matches.length ? Math.round((done / matches.length) * 100) : 0,
      },
      corrections: results.reduce((sum, r) => sum + r.corrections, 0),
      roomChampions: results
        .filter((r) => r.round === LAST_ROOM_ROUND)
        .map((r) => ({ sessionName: r.sessionName, roomName: r.roomName, champion: r.winner?.name ?? null })),
      champion: final?.status === "done" ? (person(final.winnerId)?.name ?? null) : null,
      violations: {
        total: violationRows.length,
        participants: new Set(violationRows.map((v) => v.participant.id)).size,
        byType: [...byType].map(([type, n]) => ({ type, count: n })).sort((a, b) => b.count - a.count),
      },
    },
    generatedAt: now.toISOString(),
  };
}

export type ResultQuery = {
  status?: MatchStatus;
  /** Nomor babak. */
  round?: number;
  /** Cari nama/ID peserta atau ID laga. */
  q?: string;
  onlyCorrected?: boolean;
  page?: number;
  pageSize?: number;
};

/** Saring baris rekap hasil (dipakai daftar di halaman admin & API). */
export function filterResults(rows: ResultRecapRow[], query: Omit<ResultQuery, "page" | "pageSize">) {
  const q = query.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!query.status || r.status === query.status) &&
      (!query.round || r.round === query.round) &&
      (!query.onlyCorrected || r.corrections > 0) &&
      (!q ||
        [r.participantA?.name, r.participantB?.name, r.participantA?.id, r.participantB?.id, r.matchId].some((v) =>
          v?.toLowerCase().includes(q),
        )),
  );
}

/** Saring & bagi halaman baris rekap hasil. */
export function queryResults(rows: ResultRecapRow[], query: ResultQuery) {
  const filtered = filterResults(rows, query);
  const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 500);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(query.page ?? 1, 1), pages);
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, pages };
}
