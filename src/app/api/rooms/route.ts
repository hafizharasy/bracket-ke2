import { connection } from "next/server";
import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { notifyBracketChanged } from "@/server/live";
import { createRoom, listRooms, roomInput } from "@/server/schedule";

/** GET /api/rooms — daftar ruangan + jumlah peserta, laga, dan akun pengawas (publik). */
export async function GET() {
  await connection();
  try {
    return Response.json(listRooms(), { headers: { "Cache-Control": "no-cache" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/rooms — tambah ruangan { name, location } (admin). */
export const POST = withAdmin(async (request) => {
  const parsed = roomInput.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: "Data ruangan tidak valid.", issues: z.flattenError(parsed.error).fieldErrors }, { status: 422 });
  }
  const created = createRoom(parsed.data);
  notifyBracketChanged();
  return Response.json(created, { status: 201 });
});
