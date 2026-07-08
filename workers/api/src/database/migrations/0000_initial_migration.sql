CREATE TABLE `auth_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`device_id` text,
	`device_name` text,
	`last_used_at` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_refresh_tokens_token_unique` ON `auth_refresh_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `auth_refresh_tokens_user_id_idx` ON `auth_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`staff_id` text,
	`slot` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`price` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`coupon_code` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bookings_user_id_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookings_branch_id_idx` ON `bookings` (`branch_id`);--> statement-breakpoint
CREATE INDEX `bookings_service_id_idx` ON `bookings` (`service_id`);--> statement-breakpoint
CREATE INDEX `bookings_slot_idx` ON `bookings` (`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_active_slot_unique` ON `bookings` (`branch_id`,`service_id`,`slot`) WHERE "bookings"."status" IN ('Pending', 'Confirmed');--> statement-breakpoint
CREATE TABLE `branch_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`open_time` text,
	`close_time` text,
	`is_closed` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `branch_hours_branch_id_idx` ON `branch_hours` (`branch_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `branch_hours_branch_day_unique` ON `branch_hours` (`branch_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`city` text NOT NULL,
	`area` text,
	`lat` real,
	`lng` real,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `branches_business_id_idx` ON `branches` (`business_id`);--> statement-breakpoint
CREATE INDEX `branches_area_idx` ON `branches` (`area`);--> statement-breakpoint
CREATE TABLE `business_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`url` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `business_photos_business_id_idx` ON `business_photos` (`business_id`);--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`city` text NOT NULL,
	`vertical` text DEFAULT 'booking' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`description` text,
	`phone` text,
	`email` text,
	`website` text,
	`brand_palette` text,
	`owner_id` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `businesses_owner_id_idx` ON `businesses` (`owner_id`);--> statement-breakpoint
CREATE INDEX `businesses_status_idx` ON `businesses` (`status`);--> statement-breakpoint
CREATE INDEX `businesses_city_idx` ON `businesses` (`city`);--> statement-breakpoint
CREATE INDEX `businesses_vertical_idx` ON `businesses` (`vertical`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`segment` text DEFAULT 'All' NOT NULL,
	`channels` text DEFAULT '[]' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`sent_at` text,
	`recipient_count` integer DEFAULT 0,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `campaigns_business_id_idx` ON `campaigns` (`business_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`max_uses` integer NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_business_code_unique` ON `coupons` (`business_id`,`code`) WHERE "coupons"."deletedAt" IS NULL;--> statement-breakpoint
CREATE INDEX `coupons_business_id_idx` ON `coupons` (`business_id`);--> statement-breakpoint
CREATE TABLE `customer_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`line` text NOT NULL,
	`area` text,
	`city` text,
	`lat` real,
	`lng` real,
	`is_default` integer DEFAULT false NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_addresses_user_id_idx` ON `customer_addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `demo_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`business_name` text NOT NULL,
	`message` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text
);
--> statement-breakpoint
CREATE TABLE `favourites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favourites_user_business_unique` ON `favourites` (`user_id`,`business_id`);--> statement-breakpoint
CREATE INDEX `favourites_user_id_idx` ON `favourites` (`user_id`);--> statement-breakpoint
CREATE INDEX `favourites_business_id_idx` ON `favourites` (`business_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`business_id` text,
	`booking_id` text,
	`review_id` text,
	`order_id` text,
	`go` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_id_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`,`createdAt`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_items_qty_positive" CHECK("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`total` integer NOT NULL,
	`delivery_line` text NOT NULL,
	`delivery_area` text,
	`delivery_city` text,
	`delivery_lat` real,
	`delivery_lng` real,
	`delivered_at` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_business_id_idx` ON `orders` (`business_id`);--> statement-breakpoint
CREATE INDEX `orders_branch_id_idx` ON `orders` (`branch_id`);--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_business_user_idx` ON `orders` (`business_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`recorded_by` text NOT NULL,
	`order_id` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payments_amount_positive" CHECK("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `payments_business_user_idx` ON `payments` (`business_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`price` integer NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`description` text,
	`image_url` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "products_stock_nonneg" CHECK("products"."stock" >= 0)
);
--> statement-breakpoint
CREATE INDEX `products_branch_id_idx` ON `products` (`branch_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`service_id` text NOT NULL,
	`booking_id` text,
	`rating` integer NOT NULL,
	`text` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reviews_business_id_idx` ON `reviews` (`business_id`);--> statement-breakpoint
CREATE INDEX `reviews_user_id_idx` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_booking_id_unique` ON `reviews` (`booking_id`) WHERE "reviews"."booking_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `reward_points` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_points_user_id_unique` ON `reward_points` (`user_id`);--> statement-breakpoint
CREATE TABLE `reward_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`booking_id` text,
	`type` text NOT NULL,
	`points` integer NOT NULL,
	`description` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reward_transactions_user_id_idx` ON `reward_transactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`duration` integer NOT NULL,
	`price` integer NOT NULL,
	`description` text,
	`image_url` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_branch_id_idx` ON `services` (`branch_id`);--> statement-breakpoint
CREATE TABLE `staff_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`team_member_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	`start_time` text,
	`end_time` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_availability_member_idx` ON `staff_availability` (`team_member_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`branch_id` text,
	`title` text DEFAULT 'Staff' NOT NULL,
	`role` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `team_members_business_id_idx` ON `team_members` (`business_id`);--> statement-breakpoint
CREATE INDEX `team_members_user_id_idx` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_user_business_unique` ON `team_members` (`user_id`,`business_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`phone` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`googleId` text,
	`pushToken` text,
	`photoUrl` text,
	`createdAt` text NOT NULL,
	`updatedAt` text,
	`deletedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`,`role`) WHERE "users"."email" IS NOT NULL AND "users"."deletedAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_idx` ON `users` (`phone`,`role`) WHERE "users"."phone" IS NOT NULL AND "users"."deletedAt" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_idx` ON `users` (`googleId`,`role`) WHERE "users"."googleId" IS NOT NULL AND "users"."deletedAt" IS NULL;