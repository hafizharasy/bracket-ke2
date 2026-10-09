// Seed data dasar turnamen: 4 sesi, 10 ruangan, 640 peserta (16 per sesi × ruangan).
//   npm run db:seed            → isi data yang belum ada (aman diulang)
//   npm run db:seed -- --reset → kosongkan data turnamen dulu, lalu isi ulang
// Data diambil dari data tiruan frontend supaya ID & pembagian sesi/ruangan sama.

import { sql } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";
import { matches, matchResults, participants, rooms, sessions, violations } from "@/db/schema";
import { mockBracket } from "@/lib/mock/bracket-data";

const reset = process.argv.includes("--reset");

db.transaction((tx) => {
  if (reset) {
    // Urutan mengikuti foreign key. Akun (users) tidak disentuh.
    for (const table of [violations, matchResults, matches, participants]) tx.delete(table).run();
    tx.delete(sessions).run();
    tx.delete(rooms).where(sql`${rooms.id} not in (select room_id from users where room_id is not null)`).run();
  }

  tx.insert(sessions)
    .values(
      mockBracket.sessions.map((s) => ({
        ...s,
        startTime: s.startTime ? new Date(s.startTime) : null,
      })),
    )
    .onConflictDoNothing()
    .run();

  tx.insert(rooms).values(mockBracket.rooms).onConflictDoNothing().run();

  // SQLite membatasi jumlah parameter per statement → sisipkan per batch.
  const BATCH = 100;
  for (let i = 0; i < mockBracket.participants.length; i += BATCH) {
    tx.insert(participants)
      .values(mockBracket.participants.slice(i, i + BATCH))
      .onConflictDoNothing()
      .run();
  }
});

const count = (table: typeof sessions | typeof rooms | typeof participants) =>
  db.select({ n: sql<number>`count(*)` }).from(table).get()!.n;

console.log(
  `✓ Seed ${DATABASE_PATH}${reset ? " (reset)" : ""}: ` +
    `${count(sessions)} sesi, ${count(rooms)} ruangan, ${count(participants)} peserta`,
);
