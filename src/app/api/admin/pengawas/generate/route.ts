import { z } from "zod";

import { readJson, withAdmin } from "@/server/admin-api";
import { generateMissingPengawas } from "@/server/pengawas-accounts";

const input = z.object({ domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Domain email tidak valid.").default("lrp.local") });

/**
 * POST /api/admin/pengawas/generate — { domain? } buat akun untuk setiap
 * ruangan yang belum punya pengawas aktif. 201 → { created: [{ email,
 * password, roomName, … }] }; sandi hanya ditampilkan sekali ini (admin).
 */
export const POST = withAdmin(async (request, _params, admin) => {
  const raw = request.headers.get("content-length") === "0" ? {} : await readJson(request).catch(() => ({}));
  const parsed = input.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Domain email tidak valid." }, { status: 422 });
  const created = await generateMissingPengawas(parsed.data.domain, admin.id);
  return Response.json({ created }, { status: created.length ? 201 : 200, headers: { "Cache-Control": "no-store" } });
});
