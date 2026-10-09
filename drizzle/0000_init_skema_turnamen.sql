CREATE TABLE `match_results` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`proof_photo_url` text NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_results_match_idx` ON `match_results` (`match_id`);--> statement-breakpoint
CREATE TABLE `matches` (
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
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_a_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`participant_b_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`winner_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`next_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "matches_status_check" CHECK("matches"."status" in ('scheduled', 'ongoing', 'done')),
	CONSTRAINT "matches_score_check" CHECK(coalesce("matches"."score_a", 0) >= 0 and coalesce("matches"."score_b", 0) >= 0),
	CONSTRAINT "matches_winner_check" CHECK("matches"."winner_id" is null or "matches"."winner_id" in ("matches"."participant_a_id", "matches"."participant_b_id")),
	CONSTRAINT "matches_distinct_check" CHECK("matches"."participant_a_id" is null or "matches"."participant_b_id" is null or "matches"."participant_a_id" <> "matches"."participant_b_id")
);
--> statement-breakpoint
CREATE INDEX `matches_session_room_idx` ON `matches` (`session_id`,`room_id`);--> statement-breakpoint
CREATE INDEX `matches_room_status_idx` ON `matches` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `matches_next_idx` ON `matches` (`next_match_id`);--> statement-breakpoint
CREATE INDEX `matches_round_idx` ON `matches` (`round`,`match_number`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team_or_club` text,
	`session_id` text,
	`room_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `participants_session_room_idx` ON `participants` (`session_id`,`room_id`);--> statement-breakpoint
CREATE INDEX `participants_name_idx` ON `participants` (`name`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`order_index` integer NOT NULL,
	`start_time` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`room_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "users_role_check" CHECK("users"."role" in ('admin', 'pengawas')),
	CONSTRAINT "users_room_check" CHECK(("users"."role" = 'pengawas' and "users"."room_id" is not null) or ("users"."role" = 'admin' and "users"."room_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_room_idx` ON `users` (`room_id`);--> statement-breakpoint
CREATE TABLE `violations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`match_id` text,
	`room_id` text NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	`recorded_by` text NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `violations_room_idx` ON `violations` (`room_id`);--> statement-breakpoint
CREATE INDEX `violations_participant_idx` ON `violations` (`participant_id`);--> statement-breakpoint
CREATE INDEX `violations_match_idx` ON `violations` (`match_id`);