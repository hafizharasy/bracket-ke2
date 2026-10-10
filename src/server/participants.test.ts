import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { bracketState, matches, participants, rooms, sessions } from "@/db/schema";
import { ApiError } from "@/server/errors";
import {
  createParticipant,
  deleteParticipant,
  participantCreateInput,
  searchParticipants,
  updateParticipant,
} from "@/server/participants";

function expectApiError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error(`Diharapkan ApiError ${status}, tetapi tidak ada error.`);
}

const version = () => db.select().from(bracketState).get()?.version ?? 0;

beforeAll(() => {
  migrate(db, { migrationsFolder: "drizzle" });
});

beforeEach(() => {
  for (const table of [matches, participants, rooms, sessions]) db.delete(table).run();
  db.insert(sessions).values({ id: "sesi-1", name: "Sesi 1", orderIndex: 1 }).run();
  db.insert(rooms).values({ id: "ruangan-1", name: "Ruangan 1" }).run();
  db.insert(participants).values([
    { id: "p-001", name: "Budi Santoso", teamOrClub: "LRP Bandung", sessionId: "sesi-1", roomId: "ruangan-1" },
    { id: "p-002", name: "Siti Aminah", teamOrClub: "LRP Jakarta" },
    { id: "p-003", name: "Andi Wijaya", sessionId: "sesi-1" },
  ]).run();
});

describe("searchParticipants", () => {
  it("mencari nama, ID, atau klub tanpa peka huruf besar", () => {
    expect(searchParticipants({ q: "budi" }).items.map((p) => p.id)).toEqual(["p-001"]);
    expect(searchParticipants({ q: "p-002" }).items.map((p) => p.id)).toEqual(["p-002"]);
    expect(searchParticipants({ q: "jakarta" }).total).toBe(1);
  });

  it("memfilter sesi/ruangan termasuk yang belum ditempatkan", () => {
    expect(searchParticipants({ sesi: "none" }).items.map((p) => p.id)).toEqual(["p-002"]);
    expect(searchParticipants({ sesi: "sesi-1", ruangan: "none" }).items.map((p) => p.id)).toEqual(["p-003"]);
  });

  it("membagi hasil per halaman", () => {
    const page = searchParticipants({ page: 2, pageSize: 2 });
    expect(page).toMatchObject({ total: 3, pages: 2, page: 2 });
    expect(page.items.map((p) => p.id)).toEqual(["p-003"]);
  });
});

describe("tambah/ubah/hapus peserta", () => {
  it("menambah peserta dengan ID berikutnya dan menaikkan versi bagan", () => {
    const before = version();
    const row = createParticipant(participantCreateInput.parse({ name: "Dewi Lestari", teamOrClub: "" }));
    expect(row).toMatchObject({ id: "p-004", teamOrClub: null, sessionId: null });
    expect(version()).toBe(before + 1);
  });

  it("menolak ruangan tanpa sesi dan sesi yang tidak ada", () => {
    expectApiError(() => createParticipant(participantCreateInput.parse({ name: "X Y", roomId: "ruangan-1" })), 422);
    expectApiError(() => updateParticipant("p-002", { sessionId: "sesi-9" }), 422);
  });

  it("mengubah sebagian data dan 404 untuk peserta yang tidak ada", () => {
    expect(updateParticipant("p-002", { sessionId: "sesi-1" })).toMatchObject({ name: "Siti Aminah", sessionId: "sesi-1" });
    expectApiError(() => updateParticipant("p-999", { name: "Nama" }), 404);
  });

  it("tidak menghapus peserta yang sudah masuk bagan", () => {
    db.insert(matches).values({
      id: "m1", sessionId: "sesi-1", roomId: "ruangan-1", round: 1, matchNumber: 1,
      participantAId: "p-001", participantBId: "p-003",
    }).run();
    expectApiError(() => deleteParticipant("p-001"), 409);
    deleteParticipant("p-002");
    expect(searchParticipants({}).total).toBe(2);
  });
});
