import { describe, expect, it } from "vitest";
import { isLocale, matchAcceptLanguage, resolveLocale } from "./locales";

describe("Accept-Language 맞추기", () => {
  it("가중치가 가장 높은 지원 언어를 고른다", () => {
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,ja;q=0.8,en;q=0.7")).toBe("ja");
  });

  it("지역 표기는 앞 부분만 본다(pt-PT도 pt, ko-KR도 ko)", () => {
    expect(matchAcceptLanguage("pt-PT")).toBe("pt");
    expect(matchAcceptLanguage("KO-kr,en;q=0.5")).toBe("ko");
  });

  it("가중치가 같으면 헤더에 먼저 나온 언어를 고른다", () => {
    expect(matchAcceptLanguage("es;q=0.8, pt;q=0.8")).toBe("es");
  });

  it("q=0은 그 언어를 원하지 않는다는 뜻이라 고르지 않는다", () => {
    expect(matchAcceptLanguage("ko;q=0, ja;q=0.1")).toBe("ja");
    expect(matchAcceptLanguage("ko;q=0")).toBeNull();
  });

  it("지원하지 않는 언어만 있거나, 비었거나, 형식이 깨졌으면 null이다", () => {
    expect(matchAcceptLanguage("fr,de;q=0.5")).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
    expect(matchAcceptLanguage("*;q=1, ;;;, ko;q=abc")).toBeNull();
  });
});

describe("언어 정하는 순서", () => {
  it("쿠키가 지원 언어면 Accept-Language보다 먼저다", () => {
    expect(resolveLocale("ja", "ko-KR,ko;q=0.9")).toBe("ja");
  });

  it("쿠키가 없으면 Accept-Language를 따른다", () => {
    expect(resolveLocale(undefined, "es-MX,es;q=0.9")).toBe("es");
  });

  it("잘못된 쿠키 값은 무시하고 Accept-Language를 따른다", () => {
    expect(resolveLocale("fr", "pt-BR")).toBe("pt");
    expect(resolveLocale("KO", "ja")).toBe("ja");
    expect(resolveLocale("<script>", null)).toBe("en");
  });

  it("둘 다 없거나 맞는 게 없으면 영어다", () => {
    expect(resolveLocale(null, null)).toBe("en");
    expect(resolveLocale(undefined, "fr-FR")).toBe("en");
  });

  it("isLocale은 다섯 언어 코드만 받는다", () => {
    expect(["en", "ko", "ja", "es", "pt"].every(isLocale)).toBe(true);
    expect([undefined, null, 1, "EN", "pt-BR", "zh", ""].some(isLocale)).toBe(false);
  });
});
