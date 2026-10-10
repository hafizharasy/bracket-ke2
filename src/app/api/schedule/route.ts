import { connection } from "next/server";

import { errorResponse } from "@/server/errors";
import { getSchedule } from "@/server/schedule";

/**
 * GET /api/schedule?sesi=&ruangan= — jadwal publik: jam mulai sesi dan laga
 * terurut jam (dengan nama peserta). Dipakai layar bagan & pengawas.
 */
export async function GET(request: Request) {
  await connection();
  try {
    const p = new URL(request.url).searchParams;
    return Response.json(getSchedule({ sesi: p.get("sesi") ?? undefined, ruangan: p.get("ruangan") ?? undefined }), {
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
