CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`success` integer NOT NULL,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "login_attempts_role_check" CHECK("login_attempts"."role" in ('admin', 'pengawas'))
);
--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email`,`created_at`);