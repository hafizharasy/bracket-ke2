// Ekspor rekap ke CSV (fungsi murni; dipakai unduhan di klien dan server).

import type { RecapData } from "@/lib/recap";

export type CsvSeparator = "," | ";";
export const REPORTS = ["hasil", "pelanggaran", "juara"] as const;
export type ReportKind = (typeof REPORTS)[number];

export const REPORT_INFO: Record<ReportKind, { title: string; description: string }> = {
  hasil: { title: "Hasil pertandingan", description: "Semua laga: babak, peserta, skor, pemenang, status, pencatat, koreksi." },
  pelanggaran: { title: "Pelanggaran", description: "Semua catatan pelanggaran: waktu, peserta, ruangan, laga, jenis, catatan, pencatat." },
  juara: { title: "Juara ruangan", description: "Juara tiap ruangan per sesi dan juara turnamen." },
};

const wib = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
/** "2026-10-17 08:11" (WIB) — mudah diurutkan di spreadsheet. */
const time = (iso: string | null) => (iso ? wib.format(new Date(iso)) : "");

const STATUS = { done: "Selesai", ongoing: "Berlangsung", scheduled: "Terjadwal" } as const;

/** Satu sel CSV: dikutip bila perlu; sel diawali = + - @ diberi ' (cegah formula injection). */
function cell(value: string | number | null | undefined, separator: CsvSeparator) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /["\n\r]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][], separator: CsvSeparator = ";") {
  // BOM supaya Excel membaca UTF-8 (nama dengan aksen, tanda "·").
  return "﻿" + [header, ...rows].map((r) => r.map((c) => cell(c, separator)).join(separator)).join("\r\n") + "\r\n";
}

/** Isi CSV satu jenis laporan dari data rekap. */
export function reportCsv(recap: RecapData, kind: ReportKind, separator: CsvSeparator = ";") {
  if (kind === "hasil") {
    return toCsv(
      ["ID laga", "Sesi", "Ruangan", "Babak", "No", "Jadwal (WIB)", "Peserta A", "ID A", "Skor A", "Skor B", "Peserta B", "ID B", "Pemenang", "Status", "Dicatat (WIB)", "Pencatat", "Koreksi", "Bukti", "Hasil final"],
      recap.results.map((r) => [
        r.matchId, r.sessionName, r.roomName, r.roundLabel, r.matchNumber, time(r.scheduledAt),
        r.participantA?.name, r.participantA?.id.toUpperCase(), r.scoreA, r.scoreB, r.participantB?.name, r.participantB?.id.toUpperCase(),
        r.winner?.name, STATUS[r.status], time(r.recordedAt), r.recordedBy, r.corrections, r.hasProof ? "Ada" : "", r.finalResult,
      ]),
      separator,
    );
  }
  if (kind === "pelanggaran") {
    return toCsv(
      ["Waktu (WIB)", "Peserta", "ID peserta", "Sesi", "Ruangan", "Laga", "Jenis", "Catatan", "Pencatat"],
      recap.violations.map((v) => [time(v.occurredAt), v.participant.name, v.participant.id.toUpperCase(), v.sessionName, v.roomName, v.matchLabel, v.type, v.note, v.recordedBy]),
      separator,
    );
  }
  return toCsv(
    ["Sesi", "Ruangan", "Juara ruangan"],
    [
      ...recap.summary.roomChampions.map((c) => [c.sessionName, c.roomName, c.champion ?? "Belum ada"]),
      ...(recap.filters.sesi || recap.filters.ruangan ? [] : [["Turnamen", "Final", recap.summary.champion ?? "Belum ditentukan"]]),
    ],
    separator,
  );
}

/** Nama berkas, mis. "rekap-hasil-sesi-1-ruangan-3-2026-10-17.csv". */
export function reportFilename(kind: ReportKind, recap: Pick<RecapData, "filters" | "generatedAt">) {
  const date = new Date(recap.generatedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  return ["rekap", kind, recap.filters.sesi, recap.filters.ruangan, date].filter(Boolean).join("-") + ".csv";
}
