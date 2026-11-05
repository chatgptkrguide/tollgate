import { INTL_TAGS, type Locale } from "./locales";

// Numbers, money and dates per locale. Money is always USD: only how it is written changes ("$650", "US$650",
// "650 US$"). In English every function prints exactly what domain/money.ts and domain/dates.ts print, so switching
// a component over changes nothing for an English visitor.

interface Formatters {
  wholeUsd: Intl.NumberFormat;
  exactUsd: Intl.NumberFormat;
  number: Intl.NumberFormat;
  shortDate: Intl.DateTimeFormat;
}

const cache = new Map<Locale, Formatters>();

function formatters(locale: Locale): Formatters {
  const found = cache.get(locale);
  if (found) return found;
  const tag = INTL_TAGS[locale] ?? INTL_TAGS.en;
  const made: Formatters = {
    wholeUsd: new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    exactUsd: new Intl.NumberFormat(tag, { style: "currency", currency: "USD", minimumFractionDigits: 2 }),
    number: new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }),
    // The time zone is fixed, so the server (UTC) and a browser elsewhere print the same day and hydration agrees.
    shortDate: new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", timeZone: "UTC" }),
  };
  cache.set(locale, made);
  return made;
}

// Whole dollars read cleaner; cents are shown only when there are some (like formatUsd).
export function formatMoney(locale: Locale, cents: number): string {
  const { wholeUsd, exactUsd } = formatters(locale);
  return (cents % 100 === 0 ? wholeUsd : exactUsd).format(cents / 100);
}

// Up to two decimals: hours ("12.5", "12,5") and counts ("2,000", "2.000").
export function formatNumber(locale: Locale, value: number): string {
  return formatters(locale).number.format(value);
}

// "2026-10-21" or an ISO time → "Oct 21", "10월 21일", "10月21日", "21 oct", "21 de out.". Anything that isn't a date is
// shown as written (like formatShortDate).
export function formatDate(locale: Locale, iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatters(locale).shortDate.format(date);
}
