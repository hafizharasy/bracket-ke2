import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { bracketStatus, generateBracketStructure } from "@/server/bracket-structure";
import { notifyBracketChanged } from "@/server/live";

const input = z.object({
  finalStart: z.iso.datetime({ offset: true }).optional(),
  replace: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

/** GET /api/admin/bracket/structure — jumlah laga & apakah sudah ada laga dimulai (admin). */
export const GET = withAdmin(() => Response.json(bracketStatus(), { headers: { "Cache-Control": "no-store" } }));

/**
 * POST /api/admin/bracket/structure — { finalStart?, replace?, dryRun? }
 * buat struktur bagan dari penempatan peserta (admin). 409 bila sudah ada
 * (tanpa replace) atau sudah ada hasil; 422 + `errors` bila penempatan belum lengkap.
 */
export const POST = withAdmin(async (request, _params, admin) => {
  const parsed = input.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 422 });
  const result = generateBracketStructure(parsed.data, admin.id);
  if (result.saved) notifyBracketChanged();
  return Response.json(result, { status: result.saved ? 201 : 200 });
});
