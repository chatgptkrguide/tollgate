import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import { en } from "./messages/en";
import { CATALOGS } from "./t";

// `satisfies Catalog` already stops a missing or extra key at compile time; these checks also cover what types can't
// see: the {params} and <tags> inside each text, and empty strings.

type Flat = Record<string, string>;

function flatten(catalog: Readonly<Record<string, Readonly<Record<string, string>>>>): Flat {
  const out: Flat = {};
  for (const [group, entries] of Object.entries(catalog)) {
    for (const [key, text] of Object.entries(entries)) out[`${group}.${key}`] = text;
  }
  return out;
}

const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\/?\w+)>/g)].map((m) => m[1]).sort();

const english = flatten(en);
const others = LOCALES.filter((l) => l !== "en");

describe("번역 사전의 완전성", () => {
  it("영어 사전에는 키가 100개 넘게 있고 빈 문자열이 없다", () => {
    const keys = Object.keys(english);

    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((key) => english[key].trim() === "")).toEqual([]);
  });

  it.each(others)("%s 사전은 영어와 키가 정확히 같다(빠진 키도 남는 키도 없다)", (locale) => {
    const catalog = flatten(CATALOGS[locale]);

    expect(Object.keys(catalog).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(others)("%s 사전의 모든 문장은 영어와 같은 {params}를 쓴다", (locale) => {
    const catalog = flatten(CATALOGS[locale]);

    const mismatched = Object.keys(english).filter((key) => params(catalog[key]).join() !== params(english[key]).join());

    expect(mismatched).toEqual([]);
  });

  it.each(others)("%s 사전의 모든 문장은 영어와 같은 <태그>를 쓴다", (locale) => {
    const catalog = flatten(CATALOGS[locale]);

    const mismatched = Object.keys(english).filter((key) => tags(catalog[key]).join() !== tags(english[key]).join());

    expect(mismatched).toEqual([]);
  });

  it.each(others)("%s 사전에는 빈 문장이 없다", (locale) => {
    const catalog = flatten(CATALOGS[locale]);

    expect(Object.entries(catalog).filter(([, text]) => text.trim() === "")).toEqual([]);
  });

  it("복수형 키는 모두 _one과 _other가 짝으로 있다", () => {
    const keys = Object.keys(english);
    const plural = keys.filter((key) => /_(one|other)$/.test(key));

    const unpaired = plural.filter((key) => !keys.includes(key.replace(/_(one|other)$/, (_, form: string) => (form === "one" ? "_other" : "_one"))));

    expect(plural.length).toBeGreaterThan(0);
    expect(unpaired).toEqual([]);
  });

  it("영어가 아닌 사전은 영어 문장을 그대로 베껴 두지 않는다(제품명만인 문장 제외)", () => {
    // A handful of texts are the same word in some languages ("Total", "Pago"…); a long one copied is a slip.
    const copied = others.flatMap((locale) => {
      const catalog = flatten(CATALOGS[locale]);
      return Object.keys(english)
        .filter((key) => english[key].length > 12 && catalog[key] === english[key])
        .map((key) => `${locale}:${key}`);
    });

    expect(copied).toEqual([]);
  });

  it("제품 이름 Tollgate·PayPal·Claude는 번역하지 않는다", () => {
    const names = ["Tollgate", "PayPal", "Claude"];
    const lost = others.flatMap((locale) => {
      const catalog = flatten(CATALOGS[locale]);
      return Object.keys(english).flatMap((key) =>
        names.filter((name) => english[key].includes(name) && !catalog[key].includes(name)).map((name) => `${locale}:${key}:${name}`),
      );
    });

    expect(lost).toEqual([]);
  });
});
