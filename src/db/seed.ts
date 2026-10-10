// Seed data contoh turnamen: 4 sesi, 3 ruangan (Sesi 1–2 memakai 3 ruangan,
// Sesi 3–4 memakai 2 → 10 ruangan-sesi), 640 peserta (64 per ruangan), plus
// struktur bagan: 63 laga per ruangan, semifinal, final round-robin. Belum ada hasil.
//   npm run db:seed            → isi data yang belum ada (aman diulang)
//   npm run db:seed -- --reset → kosongkan data turnamen dulu, lalu isi ulang
//                               (di production wajib --yakin bila sudah ada data; dicadangkan dulu)
//   npm run db:seed -- --dasar → hanya sesi, ruangan, & ruangan per sesi (untuk data peserta asli:
//                               lanjut db:import-peserta lalu db:buat-bagan)
// Data diambil dari data tiruan frontend supaya ID & pembagian sesi/ruangan sama.

import { eq, sql } from "drizzle-orm";

import { DATABASE_PATH, db } from "@/db";
import { CONFIRM_FLAG, guardDestructive } from "@/db/destructive-guard";
import {
  authAccounts,
  matches,
  matchOfficials,
  matchResultHistory,
  matchResults,
  participants,
  rooms,
  sessionRooms,
  sessions,
  users,
  violations,
} from "@/db/schema";
import { FINAL_ROUND, SEMIFINAL_ROUND } from "@/lib/bracket";
import { mockBracket } from "@/lib/mock/bracket-data";
import { hashUserPassword, storePasswordHash } from "@/server/credentials";
import { bumpBracketVersion } from "@/server/live";

/** Sandi akun contoh pengembangan (bukan untuk production). */
const DEV_PASSWORDS = { admin: "admin12345", pengawas: "pengawas123" } as const;
type DevHashes = Record<keyof typeof DEV_PASSWORDS, string> | null;

const reset = process.argv.includes("--reset");
const baseOnly = process.argv.includes("--dasar");

function seed(devHashes: DevHashes) {
  db.transaction((tx) => {
    if (reset) {
      // Urutan mengikuti foreign key. Akun (users) tidak disentuh.
      for (const table of [violations, matchResultHistory, matchResults, matchOfficials, matches, participants, sessionRooms]) tx.delete(table).run();
      tx.delete(sessions).run();
      tx.delete(rooms)
        .where(sql`${rooms.id} not in (select room_id from users where room_id is not null)`)
        .run();
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
    tx.insert(sessionRooms).values(mockBracket.sessionRooms).onConflictDoNothing().run();

    // Data contoh peserta & bagan (dilewati dengan --dasar).
    if (!baseOnly) {
      // SQLite membatasi jumlah parameter per statement → sisipkan per batch.
      const BATCH = 50;
      for (let i = 0; i < mockBracket.participants.length; i += BATCH) {
        tx.insert(participants)
          .values(mockBracket.participants.slice(i, i + BATCH))
          .onConflictDoNothing()
          .run();
      }

      // Struktur bagan tanpa hasil (pasangan babak 1 saja). Laga tujuan disisipkan
      // lebih dulu: semifinal, final (feed ke semifinal), lalu babak ruangan menurun.
      const rank = (round: number) => (round === SEMIFINAL_ROUND ? 0 : round === FINAL_ROUND ? 1 : 2 + (SEMIFINAL_ROUND - round));
      const structure = mockBracket.matches
        .map((m) => ({
          ...m,
          participantAId: m.round === 1 ? m.participantAId : null,
          participantBId: m.round === 1 ? m.participantBId : null,
          winnerId: null,
          scoreA: null,
          scoreB: null,
          winType: null,
          status: "scheduled" as const,
          scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
        }))
        .sort((a, b) => rank(a.round) - rank(b.round) || a.matchNumber - b.matchNumber);
      for (let i = 0; i < structure.length; i += BATCH) {
        tx.insert(matches)
          .values(structure.slice(i, i + BATCH))
          .onConflictDoNothing()
          .run();
      }
    }

    // Akun contoh untuk pengembangan: admin@lrp.local / admin12345 dan
    // ruanganN@lrp.local / pengawas123. Tidak dibuat di production — pakai
    // `npm run db:create-admin` untuk akun admin pertama.
    if (devHashes) {
      const devUsers = [
        {
          id: "u-admin",
          name: "Admin Utama",
          email: "admin@lrp.local",
          role: "admin" as const,
        },
        ...mockBracket.rooms.map((room, i) => ({
          id: `u-pengawas-${i + 1}`,
          name: `Pengawas ${room.name}`,
          email: `ruangan${i + 1}@lrp.local`,
          role: "pengawas" as const,
          roomId: room.id,
        })),
      ];
      tx.insert(users).values(devUsers).onConflictDoNothing().run();
      // Akun contoh yang belum punya sandi (mis. dibuat sebelum login asli ada) diberi sandi demo.
      const withPassword = new Set(
        tx
          .select({ userId: authAccounts.userId })
          .from(authAccounts)
          .where(eq(authAccounts.providerId, "credential"))
          .all()
          .map((a) => a.userId),
      );
      for (const user of devUsers) {
        if (!withPassword.has(user.id)) storePasswordHash(tx, user.id, devHashes[user.role]);
      }
    }

    bumpBracketVersion(tx);
  });
}

const count = (table: typeof sessions | typeof rooms | typeof participants | typeof matches) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .get()!.n;

async function main() {
  if (reset) guardDestructive(`npm run db:seed -- ${process.argv.slice(2).filter((a) => a !== CONFIRM_FLAG).join(" ")}`);
  const devHashes: DevHashes =
    process.env.NODE_ENV === "production"
      ? null
      : {
          admin: await hashUserPassword(DEV_PASSWORDS.admin),
          pengawas: await hashUserPassword(DEV_PASSWORDS.pengawas),
        };
  seed(devHashes);
  console.log(
    `✓ Seed ${DATABASE_PATH}${reset ? " (reset)" : ""}${baseOnly ? " (dasar)" : ""}: ` +
      `${count(sessions)} sesi, ${count(rooms)} ruangan, ${count(participants)} peserta, ` +
      `${count(matches)} laga`,
  );
}

void main();
