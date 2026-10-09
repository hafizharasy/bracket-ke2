import { createHash } from "node:crypto";

import { getBracketFromDb } from "@/db/queries/bracket";

/**
 * GET /api/bracket — bagan lengkap turnamen (publik, tanpa login).
 *
 * Mendukung ETag: klien yang polling mengirim `If-None-Match` dan menerima
 * 304 tanpa body selama data belum berubah, jadi polling tetap ringan.
 */
export async function GET(request: Request) {
  // Membaca header request menjadikan handler ini dinamis (tidak diprerender).
  const ifNoneMatch = request.headers.get("if-none-match");

  const data = getBracketFromDb();
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
