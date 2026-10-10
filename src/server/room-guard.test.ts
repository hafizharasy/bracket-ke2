import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { matches, rooms, sessions, users } from "@/db/schema";
import { roomFromParam, roomOfMatchParam, withRoomAccess } from "@/server/room-guard";

// Tanpa header dev, sesi dibaca dari cookie Better Auth (tidak ada di tes).
vi.mock("@/server/better-auth", () => ({ auth: { api: { getSession: async () => null } } }));

const call = (handler: ReturnType<typeof withRoomAccess<{ id: string }>>, id: string, userId?: string) =>
  handler(new Request("http://x/api", { headers: userId ? { "x-dev-user-id": userId } : {} }), { params: Promise.resolve({ id }) });

const roomView = withRoomAccess("room:view", roomFromParam, (_req, _params, access) => Response.json(access));
const resultWrite = withRoomAccess("result:write", roomOfMatchParam, (_req, { id }, { roomId }) => Response.json({ id, roomId }));

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matches, users, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values([{ id: "ruangan-1", name: "R1" }, { id: "ruangan-2", name: "R2" }]).run();
  db.insert(users).values([
    { id: "u-admin", name: "Admin", email: "a@x", role: "admin" },
    { id: "u-p1", name: "P1", email: "p1@x", role: "pengawas", roomId: "ruangan-1" },
  ]).run();
  db.insert(matches).values({ id: "m2", sessionId: "sesi-1", roomId: "ruangan-2", round: 1, matchNumber: 1 }).run();
});

describe("withRoomAccess", () => {
  it("401 tanpa login, 404 sumber tidak ada", async () => {
    expect((await call(roomView, "ruangan-1")).status).toBe(401);
    expect((await call(roomView, "ruangan-9", "u-p1")).status).toBe(404);
    expect((await call(resultWrite, "m-x", "u-p1")).status).toBe(404);
  });

  it("pengawas hanya ruangannya; admin semua ruangan", async () => {
    expect(await (await call(roomView, "ruangan-1", "u-p1")).json()).toMatchObject({ roomId: "ruangan-1", user: { id: "u-p1" } });
    expect((await call(roomView, "ruangan-2", "u-p1")).status).toBe(403);
    expect((await call(resultWrite, "m2", "u-p1")).status).toBe(403);
    expect(await (await call(resultWrite, "m2", "u-admin")).json()).toEqual({ id: "m2", roomId: "ruangan-2" });
  });
});
