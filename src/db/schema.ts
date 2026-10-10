// Skema database turnamen (SQLite + Drizzle) — mengikuti PRD bagian 6.
// Kolom snake_case di database, properti camelCase di TypeScript.

import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const USER_ROLES = ["admin", "pengawas"] as const;
export const MATCH_STATUSES = ["scheduled", "ongoing", "done"] as const;

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/** 4 sesi pertandingan. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    startTime: integer("start_time", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("sessions_name_idx").on(t.name), uniqueIndex("sessions_order_idx").on(t.orderIndex)],
);

/** 10 ruangan pertandingan. */
export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    location: text("location"),
  },
  (t) => [uniqueIndex("rooms_name_idx").on(t.name)],
);

/** Akun admin utama & pengawas ruangan. Pengawas terikat ke satu ruangan. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull(),
    // Ruangan yang masih punya pengawas tidak bisa dihapus (pindahkan akunnya dulu).
    roomId: text("room_id").references(() => rooms.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("users_role_check", sql`${t.role} in ('admin', 'pengawas')`),
    // Pengawas wajib punya ruangan; admin tidak terikat ruangan.
    check(
      "users_room_check",
      sql`(${t.role} = 'pengawas' and ${t.roomId} is not null) or (${t.role} = 'admin' and ${t.roomId} is null)`,
    ),
    index("users_room_idx").on(t.roomId),
  ],
);

/** 640 peserta, dibagi ke sesi & ruangan. */
export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    teamOrClub: text("team_or_club"),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    /** Terakhir diubah admin (nama, klub, sesi, ruangan); null bila belum pernah. */
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (t) => [
    index("participants_session_room_idx").on(t.sessionId, t.roomId),
    index("participants_name_idx").on(t.name),
  ],
);

/**
 * Pertandingan 1 vs 1. `nextMatchId` menunjuk laga tujuan pemenang
 * (auto-advance). Slot tujuan: dua laga asal → nomor kecil ke A, besar ke B;
 * satu laga asal → ke B (lihat `buildAdvanceMap`).
 */
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    round: integer("round").notNull(),
    matchNumber: integer("match_number").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    participantAId: text("participant_a_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    participantBId: text("participant_b_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    winnerId: text("winner_id").references(() => participants.id, { onDelete: "set null" }),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    status: text("status", { enum: MATCH_STATUSES }).notNull().default("scheduled"),
    nextMatchId: text("next_match_id").references((): AnySQLiteColumn => matches.id, {
      onDelete: "set null",
    }),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  },
  (t) => [
    check("matches_status_check", sql`${t.status} in ('scheduled', 'ongoing', 'done')`),
    check("matches_score_check", sql`coalesce(${t.scoreA}, 0) >= 0 and coalesce(${t.scoreB}, 0) >= 0`),
    check(
      "matches_winner_check",
      sql`${t.winnerId} is null or ${t.winnerId} in (${t.participantAId}, ${t.participantBId})`,
    ),
    check(
      "matches_distinct_check",
      sql`${t.participantAId} is null or ${t.participantBId} is null or ${t.participantAId} <> ${t.participantBId}`,
    ),
    index("matches_session_room_idx").on(t.sessionId, t.roomId),
    index("matches_room_status_idx").on(t.roomId, t.status),
    index("matches_next_idx").on(t.nextMatchId),
    index("matches_round_idx").on(t.round, t.matchNumber),
    // Satu posisi bagan = satu laga (mencegah laga ganda saat menyusun pasangan).
    uniqueIndex("matches_slot_idx").on(t.sessionId, t.roomId, t.round, t.matchNumber),
  ],
);

/** Hasil yang diinput pengawas: foto bukti & siapa yang mencatat (maks. 1 per laga). */
export const matchResults = sqliteTable(
  "match_results",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    proofPhotoUrl: text("proof_photo_url").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("match_results_match_idx").on(t.matchId),
    index("match_results_recorded_idx").on(t.recordedAt),
  ],
);

export const RESULT_ACTIONS = ["create", "correct", "cancel"] as const;

/**
 * Jejak audit setiap perubahan hasil (input pertama, koreksi, pembatalan —
 * untuk pembatalan, skor/pemenang/bukti berisi nilai yang dibatalkan). Satu baris
 * per penyimpanan, tidak pernah diubah, supaya riwayat ruangan dan koreksi
 * bisa ditelusuri. `roomId` disalin agar riwayat per ruangan cepat dibaca.
 */
export const matchResultHistory = sqliteTable(
  "match_result_history",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    action: text("action", { enum: RESULT_ACTIONS }).notNull(),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    winnerId: text("winner_id")
      .notNull()
      .references(() => participants.id),
    proofPhotoUrl: text("proof_photo_url").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    recordedAt: integer("recorded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    check("match_result_history_action_check", sql`${t.action} in ('create', 'correct', 'cancel')`),
    check("match_result_history_score_check", sql`${t.scoreA} >= 0 and ${t.scoreB} >= 0`),
    index("match_result_history_room_idx").on(t.roomId, t.recordedAt),
    index("match_result_history_match_idx").on(t.matchId, t.recordedAt),
  ],
);

/**
 * Catatan pelanggaran peserta, dicatat pengawas di ruangannya. `occurredAt`
 * = waktu kejadian (diisi pengawas), `createdAt` = waktu dicatat sistem.
 * Jenis memakai daftar baku di lib/violations; "Lainnya" wajib berisi catatan.
 */
export const violations = sqliteTable(
  "violations",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    matchId: text("match_id").references(() => matches.id, { onDelete: "set null" }),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    type: text("type").notNull(),
    note: text("note"),
    occurredAt: integer("occurred_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("violations_type_check", sql`length(trim(${t.type})) between 1 and 100`),
    check("violations_note_check", sql`${t.note} is null or length(${t.note}) <= 500`),
    check(
      "violations_other_note_check",
      sql`${t.type} <> 'Lainnya' or (${t.note} is not null and length(trim(${t.note})) > 0)`,
    ),
    index("violations_room_idx").on(t.roomId, t.occurredAt),
    index("violations_participant_idx").on(t.participantId, t.occurredAt),
    index("violations_match_idx").on(t.matchId),
  ],
);

/**
 * Versi data bagan (satu baris, id = 1). Dinaikkan dalam transaksi yang sama
 * dengan setiap perubahan hasil, supaya klien live cukup memantau angka ini.
 */
export const bracketState = sqliteTable(
  "bracket_state",
  {
    id: integer("id").primaryKey(),
    version: integer("version").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [check("bracket_state_single_row", sql`${t.id} = 1`)],
);

// Relasi untuk query API Drizzle (db.query.*).

export const sessionsRelations = relations(sessions, ({ many }) => ({
  participants: many(participants),
  matches: many(matches),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  users: many(users),
  participants: many(participants),
  matches: many(matches),
  violations: many(violations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  room: one(rooms, { fields: [users.roomId], references: [rooms.id] }),
  matchResults: many(matchResults),
  violations: many(violations),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  session: one(sessions, { fields: [participants.sessionId], references: [sessions.id] }),
  room: one(rooms, { fields: [participants.roomId], references: [rooms.id] }),
  violations: many(violations),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  session: one(sessions, { fields: [matches.sessionId], references: [sessions.id] }),
  room: one(rooms, { fields: [matches.roomId], references: [rooms.id] }),
  participantA: one(participants, {
    fields: [matches.participantAId],
    references: [participants.id],
    relationName: "participantA",
  }),
  participantB: one(participants, {
    fields: [matches.participantBId],
    references: [participants.id],
    relationName: "participantB",
  }),
  winner: one(participants, {
    fields: [matches.winnerId],
    references: [participants.id],
    relationName: "winner",
  }),
  nextMatch: one(matches, {
    fields: [matches.nextMatchId],
    references: [matches.id],
    relationName: "nextMatch",
  }),
  result: one(matchResults, { fields: [matches.id], references: [matchResults.matchId] }),
}));

export const matchResultsRelations = relations(matchResults, ({ one }) => ({
  match: one(matches, { fields: [matchResults.matchId], references: [matches.id] }),
  recorder: one(users, { fields: [matchResults.recordedBy], references: [users.id] }),
}));

export const matchResultHistoryRelations = relations(matchResultHistory, ({ one }) => ({
  match: one(matches, { fields: [matchResultHistory.matchId], references: [matches.id] }),
  room: one(rooms, { fields: [matchResultHistory.roomId], references: [rooms.id] }),
  winner: one(participants, { fields: [matchResultHistory.winnerId], references: [participants.id] }),
  recorder: one(users, { fields: [matchResultHistory.recordedBy], references: [users.id] }),
}));

export const violationsRelations = relations(violations, ({ one }) => ({
  participant: one(participants, {
    fields: [violations.participantId],
    references: [participants.id],
  }),
  match: one(matches, { fields: [violations.matchId], references: [matches.id] }),
  room: one(rooms, { fields: [violations.roomId], references: [rooms.id] }),
  recorder: one(users, { fields: [violations.recordedBy], references: [users.id] }),
}));
