import { can } from "@/lib/policy";
import { requireUser } from "@/server/auth";
import { ApiError } from "@/server/errors";

/** Endpoint khusus admin utama: 401 belum login, 403 bukan admin. */
export async function requireAdminUser(request: Request) {
  const user = await requireUser(request);
  if (!can(user, "tournament:manage")) throw new ApiError(403, "Hanya admin utama yang boleh melakukan ini.");
  return user;
}

export async function readJson(request: Request) {
  return request.json().catch(() => {
    throw new ApiError(400, "Body harus JSON.");
  });
}
