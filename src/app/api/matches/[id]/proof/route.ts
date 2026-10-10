import { eq } from "drizzle-orm";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { assertRoomAccess, requireUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";
import { detectImageType, MAX_PROOF_BYTES, saveProofPhoto } from "@/server/storage";

/**
 * POST /api/matches/:id/proof — unggah foto bukti hasil laga (multipart,
 * field "photo"). Hanya pengawas ruangan laga itu / admin. Menerima JPEG,
 * PNG, WebP hingga 5 MB (dicek dari isi berkas). 201 → { url }.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/matches/[id]/proof">) {
  try {
    const user = await requireUser(request);
    const { id } = await ctx.params;
    const match = db.select({ roomId: matches.roomId }).from(matches).where(eq(matches.id, id)).get();
    if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
    assertRoomAccess(user, match.roomId);

    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_PROOF_BYTES + 64 * 1024) throw new ApiError(413, "Foto terlalu besar (maks. 5 MB).");

    const form = await request.formData().catch(() => {
      throw new ApiError(400, "Kirim foto sebagai multipart/form-data.");
    });
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "Field \"photo\" wajib berisi berkas.");
    if (file.size > MAX_PROOF_BYTES) throw new ApiError(413, "Foto terlalu besar (maks. 5 MB).");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = detectImageType(bytes);
    if (!ext) throw new ApiError(415, "Berkas harus foto JPEG, PNG, atau WebP.");

    const saved = await saveProofPhoto(id, bytes, ext);
    return Response.json({ url: saved.url }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
