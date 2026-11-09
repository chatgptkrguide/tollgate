"use server";

import { cookies } from "next/headers";
import type { ActionResult } from "@/domain/action-result";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_S } from "./locales";

// Saves the visitor's screen language for a year. Anyone can POST to this, so the value is checked against the five
// locales; anything else changes nothing. The caller refreshes the page to see it (LocaleSwitcher).
export async function setLocale(locale: unknown): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "invalid_input" };
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE_S,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true };
}
