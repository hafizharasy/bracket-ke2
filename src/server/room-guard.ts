import { eq } from "drizzle-orm";

import { db } from "@/db";
import { getRoom } from "@/db/queries/room";
import { matches } from "@/db/schema";
import type { RoomAction } from "@/lib/policy";
import { authorize, requireUser, type SessionUser } from "@/server/auth";
import { ApiError, errorResponse } from "@/server/errors";

type Params = Record<string, string | string[]>;
type Ctx<P extends Params> = { params: Promise<P> };

export type RoomAccess = { user: SessionUser; roomId: string };

/**
 * Pembatas akses satu ruangan untuk Route Handler: login wajib (401), ruangan
 * sumber daya dicari dari parameter rute (404 bila tidak ada), lalu aturan
 * lib/policy diterapkan (403 — pengawas hanya ruangannya, admin semua).
 * Handler hanya jalan bila lolos dan menerima { user, roomId }.
 */
export function withRoomAccess<P extends Params>(
  action: RoomAction,
  roomOf: (params: P) => string | null | Promise<string | null>,
  handler: (request: Request, params: P, access: RoomAccess) => Response | Promise<Response>,
) {
  return async (request: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser(request);
      const params = await ctx.params;
      const roomId = await roomOf(params);
      if (!roomId) throw new ApiError(404, "Data tidak ditemukan.");
      authorize(user, action, { roomId });
      return await handler(request, params, { user, roomId });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Ruangan dari parameter `id` ruangan (404 bila ruangan tidak ada). */
export const roomFromParam = ({ id }: { id: string }) => {
  if (!getRoom(id)) throw new ApiError(404, "Ruangan tidak ditemukan.");
  return id;
};

/** Ruangan laga dari parameter `id` laga (404 bila laga tidak ada). */
export const roomOfMatchParam = ({ id }: { id: string }) => {
  const match = db.select({ roomId: matches.roomId }).from(matches).where(eq(matches.id, id)).get();
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return match.roomId;
};
