import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";

// The screen language of this request: the tg_locale cookie if it names a supported locale, else English (the
// browser's Accept-Language is ignored; see resolveLocale). Reads request data, so with Cache Components it belongs
// inside a <Suspense>.
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}
