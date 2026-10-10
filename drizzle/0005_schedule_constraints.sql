ALTER TABLE `participants` ADD `updated_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_slot_idx` ON `matches` (`session_id`,`room_id`,`round`,`match_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_name_idx` ON `rooms` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_name_idx` ON `sessions` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_order_idx` ON `sessions` (`order_index`);