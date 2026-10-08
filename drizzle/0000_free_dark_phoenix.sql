CREATE TABLE `order_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`note` text NOT NULL,
	`items_json` text NOT NULL,
	`total_kopiykas` integer NOT NULL,
	`currency` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_requests_order_number_unique` ON `order_requests` (`order_number`);