// Impor peserta dari Excel (.xlsx): baris sheet pertama diubah menjadi teks
// CSV yang sama dengan unggahan .csv, lalu diperiksa & disimpan oleh server
// lewat jalur impor CSV yang sudah ada.

type Cell = string | number | boolean | Date | null | undefined;

function cellText(value: Cell) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

const quote = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** Baris spreadsheet → teks CSV (pemisah koma); baris kosong di akhir dibuang. */
export function rowsToCsv(rows: Cell[][]) {
  const lines = rows.map((row) => row.map((v) => quote(cellText(v))).join(","));
  while (lines.length && /^,*$/.test(lines.at(-1)!)) lines.pop();
  return lines.join("\n") + "\n";
}

export const isXlsx = (name: string) => /\.xlsx$/i.test(name);

/** Baca sheet pertama berkas .xlsx di browser dan ubah menjadi teks CSV. */
export async function xlsxToCsv(file: Blob) {
  // Dimuat hanya saat admin memilih berkas Excel (tidak membebani halaman lain).
  const { readSheet } = await import("read-excel-file/universal");
  return rowsToCsv((await readSheet(file)) as Cell[][]);
}
