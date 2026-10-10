import { z } from "zod";

import type { Room, Session } from "@/lib/types";

export const participantFields = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(100, "Nama maksimal 100 karakter."),
  teamOrClub: z.string().trim().max(100, "Klub maksimal 100 karakter.").nullable(),
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
 * opsional `klub`, `sesi`, `ruangan` (berisi ID atau nama, mis. "Sesi 2" /
 * "Ruangan 3" / "sesi-2"). Mengembalikan baris valid dan galat per baris.
 */
export function parseParticipantCsv(text: string, sessions: Session[], rooms: Room[]) {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  const errors: ImportError[] = [];
  if (!header) return { rows: [] as ImportRow[], errors: [{ line: 1, message: "Berkas kosong." }] };
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  const iName = col("nama", "name", "nama peserta");
  const iClub = col("klub", "tim", "tim/klub", "team", "club");
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
