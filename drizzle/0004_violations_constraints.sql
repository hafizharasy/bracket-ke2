PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_violations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`match_id` text,
	`room_id` text NOT NULL,
	`type` text NOT NULL,
	`note` text,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "violations_type_check" CHECK(length(trim("__new_violations"."type")) between 1 and 100),
	CONSTRAINT "violations_note_check" CHECK("__new_violations"."note" is null or length("__new_violations"."note") <= 500),
	CONSTRAINT "violations_other_note_check" CHECK("__new_violations"."type" <> 'Lainnya' or ("__new_violations"."note" is not null and length(trim("__new_violations"."note")) > 0))
);
--> statement-breakpoint
-- Rapikan data lama agar lolos CHECK baru sebelum tabel disalin.
UPDATE `violations` SET `type` = substr(trim(`type`), 1, 100) WHERE length(trim(`type`)) > 100;--> statement-breakpoint
UPDATE `violations` SET `note` = coalesce(`note`, `type`), `type` = 'Lainnya' WHERE length(trim(`type`)) = 0;--> statement-breakpoint
UPDATE `violations` SET `note` = substr(`note`, 1, 500) WHERE length(`note`) > 500;--> statement-breakpoint
UPDATE `violations` SET `note` = '(tanpa catatan)' WHERE `type` = 'Lainnya' AND (`note` IS NULL OR length(trim(`note`)) = 0);--> statement-breakpoint
INSERT INTO `__new_violations`("id", "participant_id", "match_id", "room_id", "type", "note", "occurred_at", "recorded_by") SELECT "id", "participant_id", "match_id", "room_id", "type", "note", "occurred_at", "recorded_by" FROM `violations`;--> statement-breakpoint
DROP TABLE `violations`;--> statement-breakpoint
ALTER TABLE `__new_violations` RENAME TO `violations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `violations_room_idx` ON `violations` (`room_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `violations_participant_idx` ON `violations` (`participant_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `violations_match_idx` ON `violations` (`match_id`);