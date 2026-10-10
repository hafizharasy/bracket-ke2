import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import type { BracketData } from "@/lib/types";

export type CompletenessCheck = {
  key: string;
  label: string;
  ok: boolean;
  /** Ringkasan masalah, mis. "12 peserta belum punya sesi". */
  detail: string;
  /** Halaman untuk memperbaiki. */
  href: string;
};

/**
 * Periksa kelengkapan jadwal sebelum turnamen: penempatan peserta, isi tiap
 * ruangan per sesi, dan pasangan babak 1. Fungsi murni (tanpa I/O).
 */
export function checkScheduleCompleteness(data: Pick<BracketData, "participants" | "sessions" | "rooms" | "matches">): CompletenessCheck[] {
  const { participants, sessions, rooms, matches } = data;
  const byId = new Map(participants.map((p) => [p.id, p]));
  const roundOne = matches.filter((m) => m.round === 1);
  const cells = sessions.flatMap((s) => rooms.map((r) => ({ s, r })));
  const matchesPerRoom = PLAYERS_PER_ROOM / 2;

  const noSession = participants.filter((p) => !p.sessionId).length;
  const noRoom = participants.filter((p) => !p.roomId).length;
  const badCells = cells.filter(
    ({ s, r }) => participants.filter((p) => p.sessionId === s.id && p.roomId === r.id).length !== PLAYERS_PER_ROOM,
  );
  const cellsWithoutBracket = cells.filter(({ s, r }) => {
    const ms = roundOne.filter((m) => m.sessionId === s.id && m.roomId === r.id);
    return ms.length !== matchesPerRoom || ms.some((m) => !m.participantAId || !m.participantBId);
  });

  // Peserta babak 1 harus sesuai sesi & ruangan penempatannya, dan muncul sekali.
  const seen = new Map<string, number>();
  let mismatched = 0;
  for (const m of roundOne) {
    for (const id of [m.participantAId, m.participantBId]) {
      if (!id) continue;
      seen.set(id, (seen.get(id) ?? 0) + 1);
      const p = byId.get(id);
      if (!p || p.sessionId !== m.sessionId || p.roomId !== m.roomId) mismatched++;
    }
  }
  const duplicates = [...seen.values()].filter((n) => n > 1).length;
  const unscheduled = matches.filter((m) => !m.scheduledAt).length;
  const sessionsWithoutTime = sessions.filter((s) => !s.startTime).length;

  const check = (key: string, label: string, problems: number, detail: string, href: string): CompletenessCheck => ({
    key,
    label,
    ok: problems === 0,
    detail: problems === 0 ? "Lengkap" : detail,
    href,
  });

  return [
    check("session", "Semua peserta punya sesi", noSession, `${noSession} peserta belum punya sesi`, "/admin/peserta/sesi"),
    check("room", "Semua peserta punya ruangan", noRoom, `${noRoom} peserta belum punya ruangan`, "/admin/peserta/ruangan"),
    check(
      "cells",
      `Tiap ruangan per sesi berisi ${PLAYERS_PER_ROOM} peserta`,
      badCells.length,
      `${badCells.length} dari ${cells.length} ruangan-sesi belum pas`,
      "/admin/peserta/ruangan",
    ),
    check(
      "pairs",
      `Pasangan babak 1 lengkap (${matchesPerRoom} laga per ruangan-sesi)`,
      cellsWithoutBracket.length,
      `${cellsWithoutBracket.length} ruangan-sesi belum lengkap pasangannya`,
      "/admin/peserta/pasangan",
    ),
    check(
      "consistency",
      "Pasangan sesuai penempatan & tanpa duplikat",
      mismatched + duplicates,
      [mismatched && `${mismatched} slot tidak sesuai sesi/ruangan peserta`, duplicates && `${duplicates} peserta muncul lebih dari sekali`]
        .filter(Boolean)
        .join(" · "),
      "/admin/peserta/pasangan",
    ),
    check(
      "times",
      "Jadwal sesi & laga terisi",
      unscheduled + sessionsWithoutTime,
      [sessionsWithoutTime && `${sessionsWithoutTime} sesi tanpa jam mulai`, unscheduled && `${unscheduled} laga tanpa jadwal`]
        .filter(Boolean)
        .join(" · "),
      "/admin/ruangan",
    ),
  ];
}
