CREATE TABLE `match_result_history` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`room_id` text NOT NULL,
	`action` text NOT NULL,
	`score_a` integer NOT NULL,
	`score_b` integer NOT NULL,
	`winner_id` text NOT NULL,
	`proof_photo_url` text NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "match_result_history_action_check" CHECK("match_result_history"."action" in ('create', 'correct')),
	CONSTRAINT "match_result_history_score_check" CHECK("match_result_history"."score_a" >= 0 and "match_result_history"."score_b" >= 0)
);
--> statement-breakpoint
CREATE INDEX `match_result_history_room_idx` ON `match_result_history` (`room_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `match_result_history_match_idx` ON `match_result_history` (`match_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `match_results_recorded_idx` ON `match_results` (`recorded_at`);