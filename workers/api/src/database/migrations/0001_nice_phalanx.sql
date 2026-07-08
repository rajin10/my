CREATE TABLE `auth_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`password_hash` text,
	`password_updated_at` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_credentials_user_id_unique` ON `auth_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_credentials_user_id_idx` ON `auth_credentials` (`user_id`);