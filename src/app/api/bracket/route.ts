import { createHash } from "node:crypto";

import { getBracketFromDb } from "@/db/queries/bracket";

/**
 * GET /api/bracket — bagan turnamen (publik, tanpa login).
 *
 * Filter opsional (sama dengan URL halaman): `?sesi=<id sesi>&ruangan=<id ruangan>`.
 * ID yang tidak dikenal → 400.
 *
 * Mendukung ETag: klien yang polling mengirim `If-None-Match` dan menerima
 * 304 tanpa body selama data belum berubah, jadi polling tetap ringan.
 */
export async function GET(request: Request) {
  // Membaca header request menjadikan handler ini dinamis (tidak diprerender).
  const ifNoneMatch = request.headers.get("if-none-match");

  const params = new URL(request.url).searchParams;
  const filter = { sessionId: params.get("sesi"), roomId: params.get("ruangan") };

  const data = getBracketFromDb(filter);
  if (filter.sessionId && !data.sessions.some((s) => s.id === filter.sessionId)) {
    return Response.json({ error: `Sesi "${filter.sessionId}" tidak ditemukan.` }, { status: 400 });
  }
  if (filter.roomId && !data.rooms.some((r) => r.id === filter.roomId)) {
    return Response.json({ error: `Ruangan "${filter.roomId}" tidak ditemukan.` }, { status: 400 });
  }
  // updatedAt tidak ikut di-hash: ia jatuh ke "sekarang" bila belum ada hasil.
  const body = JSON.stringify({ ...data, updatedAt: undefined });
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;

  const headers = {
    ETag: etag,
    "Cache-Control": "no-cache",
  };
  if (ifNoneMatch === etag) return new Response(null, { status: 304, headers });

  return Response.json(data, { headers });
}
