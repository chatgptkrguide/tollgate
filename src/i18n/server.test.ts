import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "./actions";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_S } from "./locales";
import { getLocale } from "./server";

// Only the framework edge is replaced: the request's cookies and headers, and what the response sets.
const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Map<string, string>(),
  set: [] as { name: string; value: string; options: unknown }[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = request.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options: unknown) => {
      request.set.push({ name, value, options });
    },
  }),
  headers: async () => ({ get: (name: string) => request.headers.get(name.toLowerCase()) ?? null }),
}));

beforeEach(() => {
  request.cookies.clear();
  request.headers.clear();
  request.set = [];
});

describe("getLocale(): 요청의 화면 언어", () => {
  it("tg_locale 쿠키가 있으면 Accept-Language보다 쿠키를 따른다", async () => {
    request.cookies.set(LOCALE_COOKIE, "ko");
    request.headers.set("accept-language", "ja-JP,ja;q=0.9");

    expect(await getLocale()).toBe("ko");
  });

  it("쿠키가 없으면 Accept-Language에서 가장 맞는 언어를 고른다", async () => {
    request.headers.set("accept-language", "fr-FR,pt-BR;q=0.8,en;q=0.5");

    expect(await getLocale()).toBe("pt");
  });

  it("쿠키 값이 지원 언어가 아니면 무시한다", async () => {
    request.cookies.set(LOCALE_COOKIE, "de");
    request.headers.set("accept-language", "es");

    expect(await getLocale()).toBe("es");
  });

  it("쿠키도 헤더도 없으면 영어다", async () => {
    expect(await getLocale()).toBe("en");
  });
});

describe("setLocale(): 화면 언어 저장", () => {
  it("지원 언어면 tg_locale 쿠키를 1년, SameSite=Lax, 사이트 전체 경로로 저장한다", async () => {
    const result = await setLocale("ja");

    expect(result).toEqual({ ok: true });
    expect(request.set).toEqual([
      { name: LOCALE_COOKIE, value: "ja", options: { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE_S, sameSite: "lax", secure: false } },
    ]);
    expect(LOCALE_COOKIE_MAX_AGE_S).toBe(365 * 24 * 60 * 60);
  });

  it.each([["fr"], ["KO"], [""], [null], [undefined], [42], [{ locale: "ko" }], ["ko; Path=/admin"]])(
    "지원하지 않는 값 %j는 invalid_input이고 쿠키를 건드리지 않는다",
    async (value) => {
      const result = await setLocale(value);

      expect(result).toEqual({ ok: false, error: "invalid_input" });
      expect(request.set).toEqual([]);
    },
  );

  it("저장한 값을 다음 요청의 getLocale()이 읽는다", async () => {
    await setLocale("es");
    request.cookies.set(LOCALE_COOKIE, request.set[0].value);

    expect(await getLocale()).toBe("es");
  });
});
