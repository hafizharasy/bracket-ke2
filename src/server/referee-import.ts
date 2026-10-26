// Impor nama pengawas (wasit) per laga dari CSV/Excel — data PRIVAT admin.
// Alurnya: admin mengunduh daftar laga (semua laga + nama pengawas saat
// ini), mengisi kolom "Pengawas" di Excel, lalu mengunggahnya kembali.

import { asc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { matches, participants, rooms, sessions } from "@/db/schema";
import { roundLabel } from "@/lib/bracket";
import { type CsvSeparator, toCsv } from "@/lib/recap-export";
import { getMatchReferees, setMatchReferees } from "@/server/match-officials";
import { findByIdOrName, parseCsv } from "@/server/participant-import";

const wib = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function allMatches() {
  const sessionRows = db.select().from(sessions).orderBy(asc(sessions.orderIndex)).all();
  const roomRows = db.select().from(rooms).all();
  const order = new Map(sessionRows.map((s, i) => [s.id, i]));
  const roomName = new Map(roomRows.map((r) => [r.id, r.name]));
  const list = db
    .select()
    .from(matches)
    .all()
    .sort(
      (a, b) =>
        (order.get(a.sessionId) ?? 0) - (order.get(b.sessionId) ?? 0) ||
        (roomName.get(a.roomId) ?? "").localeCompare(roomName.get(b.roomId) ?? "", "id", { numeric: true }) ||
        a.round - b.round ||
        a.matchNumber - b.matchNumber,
    );
  return { sessions: sessionRows, rooms: roomRows, list };
}

export const REFEREE_HEADER = ["ID laga", "Sesi", "Ruangan", "Babak", "Laga", "Jadwal (WIB)", "Peserta A", "Peserta B", "Pengawas"];

/** Daftar semua laga + nama pengawas saat ini, untuk diisi di Excel lalu diunggah kembali. */
export function refereeSheetCsv(separator: CsvSeparator = ";") {
  const { sessions: sessionRows, rooms: roomRows, list } = allMatches();
  const ids = [...new Set(list.flatMap((m) => [m.participantAId, m.participantBId]).filter((id): id is string => !!id))];
  const names = new Map(
    ids.length ? db.select({ id: participants.id, name: participants.name }).from(participants).where(inArray(participants.id, ids)).all().map((p) => [p.id, p.name]) : [],
  );
  const sessionName = new Map(sessionRows.map((s) => [s.id, s.name]));
  const roomName = new Map(roomRows.map((r) => [r.id, r.name]));
  const referees = getMatchReferees();
  return toCsv(
    REFEREE_HEADER,
    list.map((m) => [
      m.id,
      sessionName.get(m.sessionId),
      roomName.get(m.roomId),
      roundLabel(m.round),
      m.matchNumber,
      m.scheduledAt ? wib.format(m.scheduledAt) : "",
      (m.participantAId && names.get(m.participantAId)) || "",
      (m.participantBId && names.get(m.participantBId)) || "",
      referees.get(m.id) ?? "",
    ]),
    separator,
  );
}

export type RefereeImportEntry = { line: number; matchId: string; label: string; refereeName: string };
export type RefereeImportError = { line: number; message: string };

/**
 * Baca CSV nama pengawas. Wajib kolom "Pengawas"; laga dikenali dari kolom
 * "ID laga", atau dari Sesi + Ruangan + Babak + Laga (nomor). Sel pengawas
 * kosong dilewati (nama yang sudah ada tidak dihapus).
 */
export function parseRefereeCsv(text: string) {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return { entries: [] as RefereeImportEntry[], errors: [{ line: 1, message: "Berkas kosong." }], skipped: 0 };
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  const iId = col("id laga", "id_laga", "id", "match id");
  const iSession = col("sesi", "session");
  const iRoom = col("ruangan", "room");
  const iRound = col("babak", "round");
  const iNumber = col("laga", "no", "no laga", "nomor", "nomor laga");
  const iReferee = col("pengawas", "nama pengawas", "wasit", "nama wasit", "referee");
  if (iReferee < 0) return { entries: [], errors: [{ line: 1, message: 'Header wajib punya kolom "Pengawas".' }], skipped: 0 };
  if (iId < 0 && [iSession, iRoom, iRound, iNumber].some((i) => i < 0)) {
    return { entries: [], errors: [{ line: 1, message: 'Butuh kolom "ID laga", atau kolom Sesi, Ruangan, Babak, dan Laga.' }], skipped: 0 };
  }

  const { sessions: sessionRows, rooms: roomRows, list } = allMatches();
  const byId = new Map(list.map((m) => [m.id, m]));
  const roundOf = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (/^\d+$/.test(v)) return Number(v);
    for (let r = 1; r <= 8; r++) if (roundLabel(r).toLowerCase() === v) return r;
    return null;
  };

  const entries: RefereeImportEntry[] = [];
  const errors: RefereeImportError[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const name = get(iReferee);
    if (!name) return void skipped++;
    if (name.length > 100) return errors.push({ line, message: "Nama pengawas maksimal 100 karakter." });

    let match = get(iId) ? byId.get(get(iId)) : undefined;
    if (!match) {
      const session = findByIdOrName(sessionRows, get(iSession));
      const room = findByIdOrName(roomRows, get(iRoom));
      const round = roundOf(get(iRound));
      const number = Number(get(iNumber));
      if (!session) return errors.push({ line, message: get(iSession) ? `Sesi "${get(iSession)}" tidak dikenal.` : "Sesi kosong." });
      if (!room) return errors.push({ line, message: get(iRoom) ? `Ruangan "${get(iRoom)}" tidak dikenal.` : "Ruangan kosong." });
      if (!round) return errors.push({ line, message: `Babak "${get(iRound)}" tidak dikenal (isi angka 1–8 atau mis. "64 Besar Ruangan").` });
      match = list.find((m) => m.sessionId === session.id && m.roomId === room.id && m.round === round && m.matchNumber === number);
      if (!match) return errors.push({ line, message: `Laga ${roundLabel(round)} #${get(iNumber)} di ${session.name} · ${room.name} tidak ditemukan.` });
    }
    if (seen.has(match.id)) return errors.push({ line, message: `Laga ini sudah diisi di baris ${seen.get(match.id)}.` });
    seen.set(match.id, line);
    const session = sessionRows.find((s) => s.id === match.sessionId);
    const room = roomRows.find((r) => r.id === match.roomId);
    entries.push({ line, matchId: match.id, label: `${session?.name} · ${room?.name} · ${roundLabel(match.round)} #${match.matchNumber}`, refereeName: name });
  });
  return { entries, errors, skipped };
}

/** Periksa (dryRun) lalu simpan nama pengawas dari CSV; tidak menyimpan apa pun bila ada galat. */
export function importRefereesCsv(text: string, options: { dryRun?: boolean } = {}, actorId: string | null = null) {
  const parsed = parseRefereeCsv(text);
  const summary = { filled: parsed.entries.length, skipped: parsed.skipped, errors: parsed.errors.length };
  if (options.dryRun || parsed.errors.length || parsed.entries.length === 0) return { saved: false, ...parsed, summary };
  setMatchReferees(parsed.entries.map(({ matchId, refereeName }) => ({ matchId, refereeName })), actorId);
  return { saved: true, ...parsed, summary };
}
