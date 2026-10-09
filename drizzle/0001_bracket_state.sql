CREATE TABLE `bracket_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "bracket_state_single_row" CHECK("bracket_state"."id" = 1)
);
--> statement-breakpoint
INSERT INTO `bracket_state` (`id`, `version`) VALUES (1, 0);
