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

interface Weighted {
  locale: Locale;
  q: number;
  order: number;
}

// The best supported locale for an Accept-Language header ("ko-KR,ko;q=0.9,en;q=0.8"), or null when none matches.
// Only the primary subtag counts ("pt-PT" still picks pt, our Brazilian Portuguese). A q of 0 means "not this one".
// Equal weights keep the header's order.
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const candidates: Weighted[] = [];
  header.split(",").forEach((part, order) => {
    const [range = "", ...params] = part.trim().split(";");
    const primary = range.trim().split("-")[0]?.toLowerCase();
    if (!isLocale(primary)) return;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam === undefined ? 1 : Number(qParam.slice(2));
    if (!(q > 0 && q <= 1)) return;
    candidates.push({ locale: primary, q, order });
  });
  candidates.sort((a, b) => b.q - a.q || a.order - b.order);
  return candidates[0]?.locale ?? null;
}

// The order every request follows: a valid cookie, then the browser's languages, then English.
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return matchAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
