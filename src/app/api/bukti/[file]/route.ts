import { readProofPhoto } from "@/server/storage";

/** GET /api/bukti/:file — sajikan foto bukti yang tersimpan. */
export async function GET(_request: Request, ctx: RouteContext<"/api/bukti/[file]">) {
  const { file } = await ctx.params;
  const photo = await readProofPhoto(file);
  if (!photo) return new Response("Foto tidak ditemukan.", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      // Nama berkas unik & tidak pernah ditimpa → aman di-cache lama.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
