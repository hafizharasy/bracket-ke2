import { connection } from "next/server";

import { can } from "@/lib/policy";
import { requireUser, type SessionUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";

/** Endpoint khusus admin utama: 401 belum login, 403 bukan admin. */
export async function requireAdminUser(request: Request) {
  const user = await requireUser(request);
  if (!can(user, "tournament:manage")) throw new ApiError(403, "Hanya admin utama yang boleh melakukan ini.");
  return user;
}

type Params = Record<string, string | string[]>;

/**
 * Otorisasi admin utama untuk Route Handler: selalu dibaca saat request,
 * wajib login (401) dengan peran admin & akun aktif (403), lalu handler
 * dijalankan dengan parameter rute dan akun admin. ApiError → respons JSON.
 */
export function withAdmin<P extends Params = Params>(
  handler: (request: Request, params: P, admin: SessionUser) => Response | Promise<Response>,
) {
  return async (request: Request, ctx?: { params: Promise<P> }) => {
    // Data & sesi admin tidak pernah diprerender saat build.
    await connection();
    try {
      const admin = await requireAdminUser(request);
      const params = ctx ? await ctx.params : ({} as P);
      return await handler(request, params, admin);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(request: Request) {
  return request.json().catch(() => {
    throw new ApiError(400, "Body harus JSON.");
  });
}
