ALTER TABLE `notifications` ADD `dedupe_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_idx` ON `notifications` (`dedupe_key`);