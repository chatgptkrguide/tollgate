import { eq } from "drizzle-orm";
import { isLocale, type Locale } from "../../i18n/locales";
import type { Db } from "./client";
import { projects } from "./schema";

// The project's client language: the language the PayPal invoice's description and note are written in.
// Callers pass the visitor's own project id (from the cookie), never one from a form.

export async function readClientLocale(db: Db, projectId: string): Promise<Locale | null> {
  const [row] = await db.select({ clientLocale: projects.clientLocale }).from(projects).where(eq(projects.id, projectId));
  return row?.clientLocale ?? null;
}

// True when the project exists (saving the language it already has counts). An unknown locale throws before the
// database is touched; the column's CHECK refuses one too.
export async function updateClientLocale(db: Db, projectId: string, locale: Locale): Promise<boolean> {
  if (!isLocale(locale)) throw new RangeError(`unknown locale: ${String(locale)}`);
  const { rowsAffected } = await db.update(projects).set({ clientLocale: locale }).where(eq(projects.id, projectId));
  return rowsAffected > 0;
}
