import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { rooms, users } from "@/db/schema";
import { withAdmin } from "@/server/admin-api";
import { ApiError } from "@/server/errors";
import { clearUsers } from "@/test/db";

vi.mock("@/server/better-auth", () => ({ auth: { api: { getSession: async () => null } } }));
vi.mock("next/server", () => ({ connection: async () => undefined }));

const req = (userId?: string) => new Request("http://x/api", { headers: userId ? { "x-dev-user-id": userId } : {} });
const handler = withAdmin<{ id: string }>((_request, params, admin) => {
  if (params.id === "x") throw new ApiError(404, "Tidak ada.");
  return Response.json({ id: params.id, admin: admin.id });
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  clearUsers();
  db.delete(rooms).run();
  db.insert(rooms).values({ id: "ruangan-1", name: "R1" }).run();
  db.insert(users).values([
    { id: "u-admin", name: "Admin", email: "a@x", role: "admin" },
    { id: "u-admin-off", name: "Admin Lama", email: "a2@x", role: "admin", active: false },
    { id: "u-p1", name: "P1", email: "p1@x", role: "pengawas", roomId: "ruangan-1" },
  ]).run();
});

describe("withAdmin", () => {
  it("401 tanpa login, 403 pengawas atau admin nonaktif", async () => {
    expect((await handler(req(), ctx("a"))).status).toBe(401);
    expect((await handler(req("u-p1"), ctx("a"))).status).toBe(403);
    expect((await handler(req("u-admin-off"), ctx("a"))).status).toBe(401);
  });

  it("admin aktif menjalankan handler dengan parameter; ApiError jadi respons JSON", async () => {
    expect(await (await handler(req("u-admin"), ctx("a"))).json()).toEqual({ id: "a", admin: "u-admin" });
    const notFound = await handler(req("u-admin"), ctx("x"));
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ error: "Tidak ada." });
  });
});
