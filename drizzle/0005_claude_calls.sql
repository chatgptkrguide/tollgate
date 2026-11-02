CREATE TABLE `claude_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `claude_calls_at_idx` ON `claude_calls` (`at`);--> statement-breakpoint
CREATE INDEX `claude_calls_project_idx` ON `claude_calls` (`project_id`,`at`);