-- Written by hand in place of drizzle-kit's table rebuild: dropping `projects` would cascade-delete every copy's rows
-- on a connection with foreign keys on (PRAGMA foreign_keys is ignored inside the migrator's transaction). The CHECK
-- sits on the column instead of the table; it allows the same values as projects_client_locale_known in schema.ts,
-- which the snapshot records, so drizzle-kit sees no difference. Existing rows take the default and are checked.
ALTER TABLE `projects` ADD `client_locale` text DEFAULT 'en' NOT NULL CONSTRAINT "projects_client_locale_known" CHECK(client_locale IN ('en', 'ko', 'ja', 'es', 'pt'));
