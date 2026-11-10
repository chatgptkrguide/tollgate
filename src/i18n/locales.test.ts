import { describe, expect, it } from "vitest";
import { isLocale, resolveLocale } from "./locales";

describe("언어 정하는 순서", () => {
  it("쿠키가 지원 언어면 그 언어다", () => {
    expect(resolveLocale("ja")).toBe("ja");
    expect(resolveLocale("ko")).toBe("ko");
  });

  it("쿠키가 없으면 영어다", () => {
    expect(resolveLocale(undefined)).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  it("잘못된 쿠키 값은 무시하고 영어다", () => {
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale("KO")).toBe("en");
    expect(resolveLocale("pt-BR")).toBe("en");
    expect(resolveLocale("<script>")).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });

  it("isLocale은 다섯 언어 코드만 받는다", () => {
    expect(["en", "ko", "ja", "es", "pt"].every(isLocale)).toBe(true);
    expect([undefined, null, 1, "EN", "pt-BR", "zh", ""].some(isLocale)).toBe(false);
  });
});
