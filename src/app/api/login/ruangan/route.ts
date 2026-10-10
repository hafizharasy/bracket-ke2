import { readJson } from "@/server/admin-api";
import { errorResponse } from "@/server/errors";
import { loginFailureStatus, loginWithPassword } from "@/server/login";

/**
 * POST /api/login/ruangan — login pengawas { email, password }. Berhasil:
 * cookie sesi httpOnly + { user, room }. Gagal: 401 salah, 403 bukan
 * pengawas / nonaktif / tanpa ruangan, 423 dikunci sementara (Retry-After).
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const result = await loginWithPassword(body, "pengawas", request);
    if (result.ok) return Response.json(result);
    const headers: HeadersInit = result.retryAt
      ? { "Retry-After": String(Math.max(1, Math.ceil((Date.parse(result.retryAt) - Date.now()) / 1000))) }
      : {};
    return Response.json(result, { status: loginFailureStatus(result.code), headers });
  } catch (error) {
    return errorResponse(error);
  }
}
