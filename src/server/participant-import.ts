import { asc, count, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { PLAYERS_PER_ROOM } from "@/lib/bracket";
import type { Room, Session } from "@/lib/types";
import { recordAudit } from "@/server/audit";
import { ApiError } from "@/server/errors";
import { bumpBracketVersion } from "@/server/live";

export const participantFields = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100, "Nama maksimal 100 karakter."),
  teamOrClub: z.string().trim().max(100, "Nama sekolah maksimal 100 karakter.").nullable(),
  sessionId: z.string().nullable(),
  roomId: z.string().nullable(),
});
export type ParticipantFields = z.infer<typeof participantFields>;

/** Pecah CSV sederhana (koma/titik koma, kutip ganda) menjadi baris sel. */
export function parseCsv(text: string): string[][] {
  const delimiter = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportRow = { line: number; values: ParticipantFields };
export type ImportError = { line: number; message: string };

/**
 * Ubah CSV peserta menjadi data siap simpan. Header wajib kolom `nama`;
 * opsional `sekolah` (atau `klub`), `sesi`, `ruangan` (berisi ID atau nama, mis. "Sesi 2" /
 * "Ruangan 3" / "sesi-2"). Mengembalikan baris valid dan galat per baris.
 */
export function parseParticipantCsv(text: string, sessions: Session[], rooms: Room[]) {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  const errors: ImportError[] = [];
  if (!header) return { rows: [] as ImportRow[], errors: [{ line: 1, message: "Berkas kosong." }] };
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  const iName = col("nama", "name", "nama peserta");
  const iClub = col("sekolah", "asal sekolah", "asal_sekolah", "school", "klub", "tim", "tim/klub", "team", "club");
  const iSession = col("sesi", "session");
  const iRoom = col("ruangan", "room");
  if (iName < 0) return { rows: [] as ImportRow[], errors: [{ line: 1, message: 'Header wajib punya kolom "nama".' }] };

  const findBy = <T extends { id: string; name: string }>(list: T[], raw: string) => {
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    return list.find((x) => x.id.toLowerCase() === v || x.name.toLowerCase() === v)
      // Angka saja, mis. "2" → "Sesi 2" / "Ruangan 2".
      ?? list.find((x) => /^\d+$/.test(v) && x.name.toLowerCase().endsWith(` ${v}`));
  };

  const rows: ImportRow[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const session = findBy(sessions, get(iSession));
    const room = findBy(rooms, get(iRoom));
    if (get(iSession) && !session) return errors.push({ line, message: `Sesi "${get(iSession)}" tidak dikenal.` });
    if (get(iRoom) && !room) return errors.push({ line, message: `Ruangan "${get(iRoom)}" tidak dikenal.` });
    if (room && !session) return errors.push({ line, message: "Ruangan diisi tetapi sesi kosong." });
    const parsed = participantFields.safeParse({
      name: get(iName),
      teamOrClub: get(iClub) || null,
      sessionId: session?.id ?? null,
      roomId: room?.id ?? null,
    });
    if (!parsed.success) return errors.push({ line, message: parsed.error.issues[0].message });
    rows.push({ line, values: parsed.data });
  });
  return { rows, errors };
}

/** ID peserta berikutnya berformat p-NNN (lanjut dari nomor terbesar). */
export function nextParticipantIds(existing: string[], count: number) {
  const max = existing.reduce((m, id) => Math.max(m, Number(/^p-(\d+)$/.exec(id)?.[1] ?? 0)), 0);
  const width = Math.max(3, String(max + count).length);
  return Array.from({ length: count }, (_, i) => `p-${String(max + i + 1).padStart(width, "0")}`);
}

export type ImportOptions = {
  /** Kosongkan semua peserta (dan struktur bagan) dulu sebelum menyimpan. */
  replace?: boolean;
  /** Periksa saja, jangan simpan. */
  dryRun?: boolean;
};

/**
 * Impor peserta dari teks CSV ke database (dipakai halaman admin & CLI).
 * Selain validasi per baris, dicek juga: ruangan harus dipakai sesinya dan
 * tiap ruangan-sesi maksimal 64 peserta (termasuk peserta yang sudah ada,
 * kecuali mode ganti). Mode ganti ditolak bila turnamen sudah berjalan.
 * Tidak menyimpan apa pun bila ada baris bermasalah.
 */
export function importParticipantsCsv(text: string, options: ImportOptions = {}, actorId: string | null = null) {
  const sessionRows = db.select().from(schema.sessions).orderBy(asc(schema.sessions.orderIndex)).all();
  const roomRows = db.select().from(schema.rooms).all();
  const { rows, errors } = parseParticipantCsv(
    text,
    sessionRows.map((s) => ({ id: s.id, name: s.name, orderIndex: s.orderIndex, startTime: null })),
    roomRows.map((r) => ({ id: r.id, name: r.name, location: r.location })),
  );

  // Ruangan harus dipakai sesi itu (diatur di /admin/ruangan).
  const used = new Set(db.select().from(schema.sessionRooms).all().map((c) => `${c.sessionId}|${c.roomId}`));
  const sessionName = new Map(sessionRows.map((s) => [s.id, s.name]));
  const roomName = new Map(roomRows.map((r) => [r.id, r.name]));
  const valid = rows.filter((r) => {
    const { sessionId, roomId } = r.values;
    if (sessionId && roomId && !used.has(`${sessionId}|${roomId}`)) {
      errors.push({ line: r.line, message: `${roomName.get(roomId)} tidak dipakai di ${sessionName.get(sessionId)}.` });
      return false;
    }
    return true;
  });

  // Kapasitas 64 per ruangan-sesi, termasuk peserta yang sudah ada.
  const perCell = new Map<string, number>();
  if (!options.replace) {
    for (const p of db.select({ s: schema.participants.sessionId, r: schema.participants.roomId }).from(schema.participants).all()) {
      if (p.s && p.r) perCell.set(`${p.s}|${p.r}`, (perCell.get(`${p.s}|${p.r}`) ?? 0) + 1);
    }
  }
  const before = new Map(perCell);
  for (const r of valid) {
    const { sessionId, roomId } = r.values;
    if (sessionId && roomId) perCell.set(`${sessionId}|${roomId}`, (perCell.get(`${sessionId}|${roomId}`) ?? 0) + 1);
  }
  for (const [key, n] of perCell) {
    if (n > PLAYERS_PER_ROOM) {
      const [s, r] = key.split("|");
      errors.push({
        line: 0,
        message: `${sessionName.get(s)} · ${roomName.get(r)}: ${n} peserta (maks. ${PLAYERS_PER_ROOM}${before.get(key) ? `, ${before.get(key)} sudah ada` : ""}).`,
      });
    }
  }
  errors.sort((a, b) => a.line - b.line);

  const existing = db.select({ n: count() }).from(schema.participants).get()!.n;
  const cells = [...perCell].map(([key, n]) => {
    const [s, r] = key.split("|");
    return { session: sessionName.get(s) ?? s, room: roomName.get(r) ?? r, count: n };
  });
  const summary = {
    valid: valid.length,
    withoutSession: valid.filter((r) => !r.values.sessionId).length,
    withoutRoom: valid.filter((r) => !r.values.roomId).length,
    existing,
    cells,
    preview: valid.slice(0, 10).map((r) => ({ line: r.line, ...r.values })),
  };
  if (errors.length > 0 || options.dryRun || valid.length === 0) {
    return { saved: false as const, errors, summary };
  }

  if (options.replace) {
    const started =
      db.select({ n: count() }).from(schema.matches).where(ne(schema.matches.status, "scheduled")).get()!.n +
      db.select({ n: count() }).from(schema.matchResults).get()!.n;
    if (started > 0) throw new ApiError(409, "Turnamen sudah berjalan; peserta lama tidak bisa diganti semua.");
  }

  db.transaction((tx) => {
    if (options.replace) {
      // Bagan bergantung pada peserta → ikut dikosongkan (buat ulang dari admin).
      for (const table of [schema.violations, schema.matchResultHistory, schema.matchResults, schema.matchOfficials, schema.matches, schema.participants]) {
        tx.delete(table).run();
      }
    }
    const ids = nextParticipantIds(
      tx.select({ id: schema.participants.id }).from(schema.participants).all().map((p) => p.id),
      valid.length,
    );
    for (let i = 0; i < valid.length; i += 50) {
      tx.insert(schema.participants)
        .values(valid.slice(i, i + 50).map((r, j) => ({ id: ids[i + j], ...r.values })))
        .run();
    }
    bumpBracketVersion(tx);
    recordAudit(
      {
        actorId,
        action: "participant.import",
        entity: "participant",
        entityId: null,
        summary: `Impor CSV: ${valid.length} peserta${options.replace ? ` (mengganti ${existing} peserta lama & struktur bagan)` : ""}.`,
      },
      tx,
    );
  });
  return { saved: true as const, errors, summary };
}
