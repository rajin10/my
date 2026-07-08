PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`service_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`staff_id` text,
	`slot` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`price` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`coupon_code` text,
	`source` text DEFAULT 'app' NOT NULL,
	`guest_name` text,
	`guest_phone` text,
	`walk_in_local_id` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bookings_customer_required" CHECK(( "__new_bookings"."user_id" IS NOT NULL ) OR ( "__new_bookings"."guest_name" IS NOT NULL AND "__new_bookings"."guest_phone" IS NOT NULL ))
);
--> statement-breakpoint
INSERT INTO `__new_bookings`("id", "user_id", "service_id", "branch_id", "staff_id", "slot", "status", "price", "discount", "coupon_code", "source", "guest_name", "guest_phone", "walk_in_local_id", "createdAt", "updatedAt", "deletedAt") SELECT "id", "user_id", "service_id", "branch_id", "staff_id", "slot", "status", "price", "discount", "coupon_code", 'app', NULL, NULL, NULL, "createdAt", "updatedAt", "deletedAt" FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_walk_in_local_id_unique` ON `bookings` (`walk_in_local_id`) WHERE "bookings"."walk_in_local_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `bookings_user_id_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookings_branch_id_idx` ON `bookings` (`branch_id`);--> statement-breakpoint
CREATE INDEX `bookings_service_id_idx` ON `bookings` (`service_id`);--> statement-breakpoint
CREATE INDEX `bookings_slot_idx` ON `bookings` (`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_active_slot_unique` ON `bookings` (`branch_id`,`service_id`,`slot`) WHERE "bookings"."status" IN ('Pending', 'Confirmed');--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`total` integer NOT NULL,
	`fulfillment` text DEFAULT 'delivery' NOT NULL,
	`delivery_line` text,
	`delivery_area` text,
	`delivery_city` text,
	`delivery_lat` real,
	`delivery_lng` real,
	`delivered_at` text,
	`source` text DEFAULT 'app' NOT NULL,
	`guest_name` text,
	`guest_phone` text,
	`walk_in_local_id` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "orders_customer_required" CHECK(( "__new_orders"."user_id" IS NOT NULL ) OR ( "__new_orders"."guest_name" IS NOT NULL AND "__new_orders"."guest_phone" IS NOT NULL )),
	CONSTRAINT "orders_delivery_line_required" CHECK(( "__new_orders"."fulfillment" = 'counter' ) OR ( "__new_orders"."delivery_line" IS NOT NULL ))
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "business_id", "branch_id", "user_id", "status", "total", "fulfillment", "delivery_line", "delivery_area", "delivery_city", "delivery_lat", "delivery_lng", "delivered_at", "source", "guest_name", "guest_phone", "walk_in_local_id", "createdAt", "updatedAt", "deletedAt") SELECT "id", "business_id", "branch_id", "user_id", "status", "total", 'delivery', "delivery_line", "delivery_area", "delivery_city", "delivery_lat", "delivery_lng", "delivered_at", 'app', NULL, NULL, NULL, "createdAt", "updatedAt", "deletedAt" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_walk_in_local_id_unique` ON `orders` (`walk_in_local_id`) WHERE "orders"."walk_in_local_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_business_id_idx` ON `orders` (`business_id`);--> statement-breakpoint
CREATE INDEX `orders_branch_id_idx` ON `orders` (`branch_id`);--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_business_user_idx` ON `orders` (`business_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `branches` ADD `walk_in_qr_version` integer DEFAULT 0 NOT NULL;