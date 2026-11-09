ALTER TABLE `paypal_sends` ADD `project_id` text;--> statement-breakpoint
CREATE INDEX `paypal_sends_project_idx` ON `paypal_sends` (`project_id`,`at`);