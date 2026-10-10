CREATE TABLE `match_officials` (
	`match_id` text PRIMARY KEY NOT NULL,
	`referee_name` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `session_rooms` (
	`session_id` text NOT NULL,
	`room_id` text NOT NULL,
	PRIMARY KEY(`session_id`, `room_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_rooms_room_idx` ON `session_rooms` (`room_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`round` integer NOT NULL,
	`match_number` integer NOT NULL,
	`session_id` text NOT NULL,
	`room_id` text NOT NULL,
	`participant_a_id` text,
	`participant_b_id` text,
	`winner_id` text,
	`score_a` integer,
	`score_b` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`next_match_id` text,
	`scheduled_at` integer,
	`feed_a_id` text,
	`feed_b_id` text,
	`win_type` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_a_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`participant_b_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`next_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`feed_a_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`feed_b_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "matches_status_check" CHECK("__new_matches"."status" in ('scheduled', 'ongoing', 'done')),
	CONSTRAINT "matches_win_type_check" CHECK("__new_matches"."win_type" is null or "__new_matches"."win_type" in ('empat', 'tiga', 'tiga_tercepat', 'dua_terbanyak')),
	CONSTRAINT "matches_score_check" CHECK(coalesce("__new_matches"."score_a", 0) >= 0 and coalesce("__new_matches"."score_b", 0) >= 0),
	CONSTRAINT "matches_winner_check" CHECK("__new_matches"."winner_id" is null or "__new_matches"."winner_id" in ("__new_matches"."participant_a_id", "__new_matches"."participant_b_id")),
	CONSTRAINT "matches_distinct_check" CHECK("__new_matches"."participant_a_id" is null or "__new_matches"."participant_b_id" is null or "__new_matches"."participant_a_id" <> "__new_matches"."participant_b_id")
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "round", "match_number", "session_id", "room_id", "participant_a_id", "participant_b_id", "winner_id", "score_a", "score_b", "status", "next_match_id", "scheduled_at") SELECT "id", "round", "match_number", "session_id", "room_id", "participant_a_id", "participant_b_id", "winner_id", "score_a", "score_b", "status", "next_match_id", "scheduled_at" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `matches_session_room_idx` ON `matches` (`session_id`,`room_id`);--> statement-breakpoint
CREATE INDEX `matches_room_status_idx` ON `matches` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `matches_next_idx` ON `matches` (`next_match_id`);--> statement-breakpoint
CREATE INDEX `matches_round_idx` ON `matches` (`round`,`match_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_slot_idx` ON `matches` (`session_id`,`room_id`,`round`,`match_number`);--> statement-breakpoint
-- Ruangan per sesi untuk data lama: pasangan sesi × ruangan yang sudah dipakai peserta atau laga.
INSERT OR IGNORE INTO `session_rooms` (`session_id`, `room_id`)
  SELECT DISTINCT `session_id`, `room_id` FROM `participants` WHERE `session_id` IS NOT NULL AND `room_id` IS NOT NULL;--> statement-breakpoint
INSERT OR IGNORE INTO `session_rooms` (`session_id`, `room_id`)
  SELECT DISTINCT `session_id`, `room_id` FROM `matches`;
