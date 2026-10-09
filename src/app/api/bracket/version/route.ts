import { getBracketVersion } from "@/server/live";

/**
 * GET /api/bracket/version — versi data bagan saat ini, sangat ringan.
 * Fallback polling bila stream SSE tidak tersedia. Mendukung ETag/304.
 */
export async function GET(request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match");
  const current = await getBracketVersion();
  const headers = { ETag: `"v${current.version}"`, "Cache-Control": "no-cache" };
  if (ifNoneMatch === headers.ETag) return new Response(null, { status: 304, headers });
  return Response.json(current, { headers });
}
