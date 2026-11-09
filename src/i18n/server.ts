import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";

// The screen language of this request: the tg_locale cookie if it names a supported locale, else the best match for
// Accept-Language, else English. Reads request data, so with Cache Components it belongs inside a <Suspense>.
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}
