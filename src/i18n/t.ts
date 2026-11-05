import { DEFAULT_LOCALE, INTL_TAGS, isLocale, type Locale } from "./locales";
import { en, type Catalog } from "./messages/en";
import { es } from "./messages/es";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { pt } from "./messages/pt";

// Looking up and filling interface text. Works on the server and in the browser; a client component that imports it
// carries all five catalogs (a few tens of kB), so a server component that passes strings down is the lighter choice.

export const CATALOGS = { en, ko, ja, es, pt } as const satisfies Record<Locale, Catalog>;

type En = typeof en;

// "group.key" for every entry of the English catalog.
export type MessageKey = { [G in keyof En]: `${G & string}.${keyof En[G] & string}` }[keyof En];

// The English text of a key, as a literal type, so its {params} can be read off it.
type MessageText<K extends string> = K extends `${infer G}.${infer N}`
  ? G extends keyof En
    ? N extends keyof En[G]
      ? En[G][N]
      : never
    : never
  : never;

type ParamNames<S> = S extends `${string}{${infer P}}${infer Rest}` ? P | ParamNames<Rest> : never;

export type MessageParams<K extends MessageKey> = Record<ParamNames<MessageText<K>>, string | number>;

// The params argument is required exactly when the English text has {params}.
type ParamsArg<K extends MessageKey> = [ParamNames<MessageText<K>>] extends [never] ? [] : [params: MessageParams<K>];

// Keys that come as a pair base_one / base_other.
type PluralBaseOf<K> = K extends `${infer B}_other` ? (`${B}_one` extends MessageKey ? B : never) : never;
export type PluralKey = PluralBaseOf<MessageKey>;

type PluralParamsArg<B extends PluralKey> = [Exclude<ParamNames<MessageText<`${B}_other`>>, "count">] extends [never]
  ? []
  : [params: Record<Exclude<ParamNames<MessageText<`${B}_other`>>, "count">, string | number>];

// The raw text of a key in a locale, falling back to English (an unknown locale, or a key missing at run time),
// then to the key itself so a slip shows on screen instead of crashing.
export function rawMessage(locale: Locale, key: MessageKey): string {
  const [group, name] = key.split(".") as [keyof Catalog, string];
  const pick = (catalog: Catalog): string | undefined => (catalog[group] as Readonly<Record<string, string>> | undefined)?.[name];
  const catalog: Catalog = isLocale(locale) ? CATALOGS[locale] : CATALOGS[DEFAULT_LOCALE];
  return pick(catalog) ?? pick(CATALOGS[DEFAULT_LOCALE]) ?? key;
}

// Fills {name} with params[name]; a name without a value stays as written.
export function interpolate(text: string, params: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

export function t<K extends MessageKey>(locale: Locale, key: K, ...params: ParamsArg<K>): string {
  return interpolate(rawMessage(locale, key), params[0]);
}

const pluralRules = new Map<Locale, Intl.PluralRules>();
const integers = new Map<Locale, Intl.NumberFormat>();

// The plural form for count in this locale (Intl.PluralRules), with {count} written in the locale's digits.
export function tCount<B extends PluralKey>(locale: Locale, base: B, count: number, ...params: PluralParamsArg<B>): string {
  const safe = isLocale(locale) ? locale : DEFAULT_LOCALE;
  let rules = pluralRules.get(safe);
  if (!rules) pluralRules.set(safe, (rules = new Intl.PluralRules(INTL_TAGS[safe])));
  let numbers = integers.get(safe);
  if (!numbers) integers.set(safe, (numbers = new Intl.NumberFormat(INTL_TAGS[safe], { maximumFractionDigits: 2 })));
  const key = (rules.select(count) === "one" ? `${base}_one` : `${base}_other`) as MessageKey;
  return interpolate(rawMessage(safe, key), { ...params[0], count: numbers.format(count) });
}

export interface RichPart {
  tag: string | null; // "b", "link", "nowrap", … or null for plain text
  text: string;
}

const TAGGED = /<(\w+)>([\s\S]*?)<\/\1>/g;

// Splits a text with <tag>…</tag> marks into parts, then fills {params} in each part. The marks are read before the
// params go in, so a value that happens to contain "<b>" stays plain text.
export function splitRich(template: string, params: Readonly<Record<string, string | number>> = {}): RichPart[] {
  const parts: RichPart[] = [];
  let at = 0;
  for (const match of template.matchAll(TAGGED)) {
    if (match.index > at) parts.push({ tag: null, text: template.slice(at, match.index) });
    parts.push({ tag: match[1], text: match[2] });
    at = match.index + match[0].length;
  }
  if (at < template.length) parts.push({ tag: null, text: template.slice(at) });
  return parts.map((part) => ({ tag: part.tag, text: interpolate(part.text, params) }));
}

// t() for texts with <b>, <link> or <nowrap> marks: the component maps each part to an element.
export function tRich<K extends MessageKey>(locale: Locale, key: K, ...params: ParamsArg<K>): RichPart[] {
  return splitRich(rawMessage(locale, key), params[0]);
}
