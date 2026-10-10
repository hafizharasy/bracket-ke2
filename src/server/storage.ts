import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Folder penyimpanan foto bukti; arahkan ke volume persisten lewat env UPLOAD_DIR. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "data/uploads";
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type Ext = keyof typeof TYPES;

/** Kenali jenis gambar dari tanda tangan berkas (bukan dari nama/MIME kiriman klien). */
export function detectImageType(bytes: Uint8Array): Ext | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

// Nama berkas: <id laga>-<uuid>.<ext>. Dipakai juga untuk menolak path traversal.
const NAME_PATTERN = /^[a-z0-9-]+-[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const proofUrl = (name: string) => `/api/bukti/${name}`;

/** URL bukti yang sah untuk laga tertentu (diunggah lewat endpoint ini). */
export function isProofUrlForMatch(url: string, matchId: string) {
  const prefix = `/api/bukti/${matchId}-`;
  return url.startsWith(prefix) && NAME_PATTERN.test(url.slice("/api/bukti/".length));
}

export async function saveProofPhoto(matchId: string, bytes: Uint8Array, ext: Ext) {
  const name = `${matchId}-${crypto.randomUUID()}.${ext}`;
  if (!NAME_PATTERN.test(name)) throw new Error("ID laga tidak valid untuk nama berkas.");
  await mkdir(/*turbopackIgnore: true*/ UPLOAD_DIR, { recursive: true }); // folder runtime, jangan ikut di-trace
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), bytes, { flag: "wx" });
  return { name, url: proofUrl(name) };
}

/** Baca berkas bukti; null bila nama tidak sah atau berkas tidak ada. */
export async function readProofPhoto(name: string) {
  if (!NAME_PATTERN.test(name)) return null;
  try {
    const bytes = await readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name));
    return { bytes, type: TYPES[name.split(".").pop() as Ext] };
  } catch {
    return null;
  }
}
