import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import { getBracketFromDb } from "@/db/queries/bracket";
import { getBracket } from "@/lib/get-bracket";
import { bracketSource, getBracketVersion } from "@/server/live";

/** Respons bagan utuh terakhir; dipakai ulang selama versi bagan belum berubah. */
let memo: { version: number; body: string; gzip: Buffer; etag: string } | null = null;

const etagOf = (body: string) => `"${createHash("sha1").update(body).digest("base64url")}"`;

function respond(request: Request, body: string, etag: string, gzip?: Buffer) {
  const headers = { ETag: etag, "Cache-Control": "no-cache", Vary: "Accept-Encoding" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  // Bagan utuh ±280 KB → ±25 KB terkompresi; dikompres sekali per versi, bukan per penonton.
  if (gzip && /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    return new Response(new Uint8Array(gzip), { headers: { ...headers, "Content-Type": "application/json", "Content-Encoding": "gzip" } });
  }
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json" } });
}

/**
 * GET /api/bracket — bagan turnamen (publik, tanpa login). Sumber data
 * halaman publik: ratusan penonton memuat ulang bersamaan setelah hasil
 * masuk, jadi bagan utuh disusun sekali per versi lalu dipakai ulang.
 *
 * Filter opsional (sama dengan URL halaman): `?sesi=<id sesi>&ruangan=<id ruangan>`.
 * ID yang tidak dikenal → 400.
 *
 * Mendukung ETag: klien yang polling mengirim `If-None-Match` dan menerima
 * 304 tanpa body selama data belum berubah, jadi polling tetap ringan.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filter = { sessionId: params.get("sesi"), roomId: params.get("ruangan") };

  if (!filter.sessionId && !filter.roomId) {
    const { version } = await getBracketVersion();
    if (memo?.version !== version) {
      // Versi dibaca lebih dulu: data yang tersimpan paling tidak sebaru versi ini.
      const data = bracketSource() === "mock" ? await getBracket() : getBracketFromDb();
      const body = JSON.stringify(data);
      memo = { version, body, gzip: gzipSync(body), etag: etagOf(body) };
    }
    return respond(request, memo.body, memo.etag, memo.gzip);
  }

  const data = getBracketFromDb(filter);
  if (filter.sessionId && !data.sessions.some((s) => s.id === filter.sessionId)) {
    return Response.json({ error: `Sesi "${filter.sessionId}" tidak ditemukan.` }, { status: 400 });
  }
  if (filter.roomId && !data.rooms.some((r) => r.id === filter.roomId)) {
    return Response.json({ error: `Ruangan "${filter.roomId}" tidak ditemukan.` }, { status: 400 });
  }
  const body = JSON.stringify(data);
  return respond(request, body, etagOf(body));
}
