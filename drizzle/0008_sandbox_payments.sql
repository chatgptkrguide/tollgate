CREATE TABLE `sandbox_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`change_order_id` text NOT NULL,
	`project_id` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sandbox_payments_at_idx` ON `sandbox_payments` (`at`);--> statement-breakpoint
CREATE INDEX `sandbox_payments_project_idx` ON `sandbox_payments` (`project_id`,`at`);