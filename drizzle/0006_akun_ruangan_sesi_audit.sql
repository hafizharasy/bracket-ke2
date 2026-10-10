ALTER TABLE `rooms` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `updated_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`room_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "users_role_check" CHECK("__new_users"."role" in ('admin', 'pengawas')),
	CONSTRAINT "users_room_check" CHECK(("__new_users"."role" = 'pengawas' and "__new_users"."room_id" is not null) or ("__new_users"."role" = 'admin' and "__new_users"."room_id" is null)),
	CONSTRAINT "users_active_check" CHECK("__new_users"."active" in (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password_hash", "role", "room_id", "created_at") SELECT "id", "name", "email", "password_hash", "role", "room_id", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_room_idx` ON `users` (`room_id`);