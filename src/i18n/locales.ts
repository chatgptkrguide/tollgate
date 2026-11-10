// The languages Tollgate speaks, for the screen (the visitor's choice) and for the PayPal invoice (the project's
// client language). Plain data and pure functions only: schema.ts, the client switcher and the server all import it.
// No "@/" imports here: drizzle-kit loads this file through schema.ts without the path alias.

export const LOCALES = ["en", "ko", "ja", "es", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Each language written in itself, for the switcher.
export const LOCALE_NAMES = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  es: "Español",
  pt: "Português",
} as const satisfies Record<Locale, string>;

// The BCP 47 tag each locale formats numbers and dates with; also what <html lang> says. pt is Brazilian Portuguese.
export const INTL_TAGS = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  es: "es-ES",
  pt: "pt-BR",
} as const satisfies Record<Locale, string>;

// The visitor's choice of screen language. Not HttpOnly: it says nothing secret, and only the server reads it.
export const LOCALE_COOKIE = "tg_locale";
export const LOCALE_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// The screen language of a request: the visitor's own choice (a valid tg_locale cookie), else English. The browser's
// Accept-Language is not consulted: the demo conversation and scope are English, so a Korean browser would otherwise
// show Korean buttons around English messages. Every language stays one pick away in the top bar.
export function resolveLocale(cookieValue: string | null | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}
