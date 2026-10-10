import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

/** GET /api/health — cek server & database (dipakai healthcheck Railway). */
export async function GET() {
  await connection();
  try {
    db.get(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "Database tidak dapat diakses." }, { status: 503 });
  }
}
