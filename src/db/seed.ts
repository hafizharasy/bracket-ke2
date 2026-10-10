// Seed data dasar turnamen: 4 sesi, 10 ruangan, 640 peserta (16 per sesi × ruangan),
// plus struktur bagan awal: semua laga terjadwal, pasangan babak 1 tiap ruangan,
// dan tautan next_match_id (termasuk juara ruangan → babak final). Belum ada hasil.
//   npm run db:seed            → isi data yang belum ada (aman diulang)
//   npm run db:seed -- --reset → kosongkan data turnamen dulu, lalu isi ulang
// Data diambil dari data tiruan frontend supaya ID & pembagian sesi/ruangan sama.

import { sql } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";
import { matches, matchResults, participants, rooms, sessions, users, violations } from "@/db/schema";
import { championSlots, mockBracket } from "@/lib/mock/bracket-data";
import { bumpBracketVersion } from "@/server/live";

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
  const BATCH = 50;
  for (let i = 0; i < mockBracket.participants.length; i += BATCH) {
    tx.insert(participants)
      .values(mockBracket.participants.slice(i, i + BATCH))
      .onConflictDoNothing()
      .run();
  }

  // Struktur bagan tanpa hasil. Babak tertinggi lebih dulu supaya laga tujuan
  // next_match_id selalu sudah ada saat laga asalnya disisipkan.
  const structure = mockBracket.matches
    .map((m) => ({
      ...m,
      participantAId: m.round === 1 ? m.participantAId : null,
      participantBId: m.round === 1 ? m.participantBId : null,
      winnerId: null,
      scoreA: null,
      scoreB: null,
      status: "scheduled" as const,
      nextMatchId: m.nextMatchId ?? championSlots.get(m.id)?.matchId ?? null,
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
    }))
    .sort((a, b) => b.round - a.round || a.matchNumber - b.matchNumber);
  for (let i = 0; i < structure.length; i += BATCH) {
    tx.insert(matches).values(structure.slice(i, i + BATCH)).onConflictDoNothing().run();
  }

  // Akun contoh untuk pengembangan (admin + pengawas tiap ruangan). Sandi
  // placeholder "!" tidak bisa dipakai login; tidak dibuat di production.
  if (process.env.NODE_ENV !== "production") {
    tx.insert(users)
      .values([
        { id: "u-admin", name: "Admin Utama", email: "admin@lrp.local", passwordHash: "!", role: "admin" as const },
        ...mockBracket.rooms.map((room, i) => ({
          id: `u-pengawas-${i + 1}`,
          name: `Pengawas ${room.name}`,
          email: `ruangan${i + 1}@lrp.local`,
          passwordHash: "!",
          role: "pengawas" as const,
          roomId: room.id,
        })),
      ])
      .onConflictDoNothing()
      .run();
  }

  bumpBracketVersion(tx);
});

const count = (table: typeof sessions | typeof rooms | typeof participants | typeof matches) =>
  db.select({ n: sql<number>`count(*)` }).from(table).get()!.n;

console.log(
  `✓ Seed ${DATABASE_PATH}${reset ? " (reset)" : ""}: ` +
    `${count(sessions)} sesi, ${count(rooms)} ruangan, ${count(participants)} peserta, ` +
    `${count(matches)} laga`,
);
