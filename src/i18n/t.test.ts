import { describe, expect, it } from "vitest";
import type { ActionError, PayPalActionError } from "@/domain/action-result";
import { formatShortDate } from "@/domain/dates";
import { formatUsd } from "@/domain/money";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "./format";
import type { Locale } from "./locales";
import { interpolate, splitRich, t, tCount, tRich } from "./t";

describe("t(): 찾기와 채우기", () => {
  it("키의 문장을 그 언어로 돌려준다", () => {
    expect(t("en", "scope.title")).toBe("Scope");
    expect(t("ko", "scope.title")).toBe("작업 범위");
    expect(t("ja", "reset.reset")).toBe("デモをリセット");
  });

  it("{name} 자리를 params 값으로 채운다(숫자도 문자열로)", () => {
    expect(t("en", "composer.label", { client: "Maya" })).toBe("New message from Maya");
    expect(t("es", "changeOrderErrors.copy_rate_limited", { max: 3 })).toContain("sus 3 envíos");
  });

  it("값이 없는 자리는 그대로 두고, params에 없는 이름을 더 줘도 무시한다", () => {
    expect(interpolate("Hi {name}, {missing}", { name: "Maya", extra: "x" })).toBe("Hi Maya, {missing}");
  });

  it("값에 든 {다른 이름}은 다시 채우지 않는다", () => {
    expect(interpolate("{a} and {b}", { a: "{b}", b: "B" })).toBe("{b} and B");
  });

  it("모르는 언어가 오면 영어로 돌아간다", () => {
    expect(t("fr" as Locale, "scope.title")).toBe("Scope");
    expect(t("" as Locale, "composer.label", { client: "Maya" })).toBe("New message from Maya");
  });

  it("params가 필요한 키에 params를 빼면 타입 오류다", () => {
    // @ts-expect-error: composer.label needs { client }
    const missing = t("en", "composer.label");
    // @ts-expect-error: scope.title takes no params
    const extra = t("en", "scope.title", { x: 1 });

    expect(missing).toBe("New message from {client}");
    expect(extra).toBe("Scope");
  });

  it("오류 코드로 만든 키도 타입이 맞고, 그 중 하나라도 쓰는 params를 받는다", () => {
    const codes: readonly (ActionError | PayPalActionError)[] = ["not_found", "copy_rate_limited"];

    const texts = codes.map((code) => t("ko", `changeOrderErrors.${code}`, { max: 3 }));

    expect(texts[0]).toBe("이 추가 견적은 내 데모에 없어요. 페이지를 새로고침하세요.");
    expect(texts[1]).toContain("발송 3회");
  });
});

describe("tCount(): 복수형", () => {
  it("영어는 1이면 단수, 그 밖은 복수를 고른다", () => {
    expect(tCount("en", "delivery.days", 1)).toBe("1 day");
    expect(tCount("en", "delivery.days", 3)).toBe("3 days");
    expect(tCount("en", "activity.steps", 0)).toBe("0 steps");
  });

  it("한국어·일본어는 형태가 하나라 _other를 쓴다", () => {
    expect(tCount("ko", "delivery.days", 1)).toBe("1일");
    expect(tCount("ja", "composer.marked", 2)).toContain("2 件");
  });

  it("스페인어·포르투갈어도 1은 단수, 2는 복수다", () => {
    expect(tCount("es", "delivery.days", 1)).toBe("1 día");
    expect(tCount("es", "delivery.days", 2)).toBe("2 días");
    expect(tCount("pt", "delivery.days", 2)).toBe("2 dias");
  });

  it("{count}는 그 언어의 숫자 표기로 쓴다", () => {
    expect(tCount("en", "delivery.days", 1500)).toBe("1,500 days");
    expect(tCount("es", "delivery.days", 1500)).toBe("1500 días"); // es-ES groups only from five digits
    expect(tCount("pt", "delivery.days", 1500)).toBe("1.500 dias");
  });
});

describe("tRich(): 강조·링크 표시", () => {
  it("<b>·<link> 표시를 조각으로 나누고 각 조각의 {params}를 채운다", () => {
    expect(tRich("en", "guide.step1Target", { author: "Maya", sentOn: "Oct 28" })).toEqual([
      { tag: null, text: "Live Claude checks are off on this public demo. Maya's Oct 28 message already has a " },
      { tag: "link", text: "marked request" },
      { tag: null, text: " — start at step 3." },
    ]);
  });

  it("번역에서 태그 위치가 바뀌어도 그 언어의 순서대로 나온다", () => {
    const parts = tRich("ko", "delivery.launchIfPaid", { date: "11월 18일" });

    expect(parts).toEqual([
      { tag: null, text: "잠긴 작업이 결제되면 출시일이 " },
      { tag: "nowrap", text: "11월 18일" },
      { tag: null, text: "로 바뀌어요." },
    ]);
  });

  it("값에 든 <b>는 표시가 아니라 글자로 남는다", () => {
    expect(splitRich("From {client}", { client: "<b>Evil</b>" })).toEqual([{ tag: null, text: "From <b>Evil</b>" }]);
  });

  it("표시가 없는 문장은 조각 하나다", () => {
    expect(tRich("en", "scope.title")).toEqual([{ tag: null, text: "Scope" }]);
  });
});

describe("숫자·금액·날짜 표기", () => {
  it("영어 금액은 domain/money의 formatUsd와 똑같다", () => {
    for (const cents of [0, 5000, 65000, 123456, 99, 100000000]) {
      expect(formatMoney("en", cents)).toBe(formatUsd(cents));
    }
  });

  it("영어 날짜는 domain/dates의 formatShortDate와 똑같고, 날짜가 아니면 그대로 둔다", () => {
    for (const iso of ["2026-10-21", "2026-10-28T11:40:00Z", "2026-12-31T23:59:59Z", "not a date"]) {
      expect(formatDate("en", iso)).toBe(formatShortDate(iso));
    }
  });

  it("금액은 언어가 달라도 USD이고 표기만 바뀐다", () => {
    expect(formatMoney("ko", 65000)).toBe("US$650");
    expect(formatMoney("ja", 65000)).toBe("$650");
    expect(formatMoney("pt", 65050)).toMatch(/^US\$\s650,50$/);
    expect(formatMoney("es", 65000)).toMatch(/^650\sUS\$$/);
  });

  it("날짜는 UTC 기준 그 언어의 짧은 표기다", () => {
    expect(formatDate("ko", "2026-10-21T23:30:00Z")).toBe("10월 21일");
    expect(formatDate("ja", "2026-10-21")).toBe("10月21日");
  });

  it("진행 기록 시각은 UTC 24시간제로, 영어는 전과 똑같이 쓴다", () => {
    const iso = "2026-11-05T04:03:00Z";

    const [en, ko, ja] = (["en", "ko", "ja"] as const).map((locale) => formatDateTime(locale, iso));

    expect(en).toBe("Nov 5, 04:03");
    expect(ko).toBe("11월 5일 04:03");
    expect(ja).toBe("11月5日 04:03");
  });

  it("진행 기록 시각이 날짜가 아니면 빈 문자열이다", () => {
    expect(formatDateTime("en", "not a time")).toBe("");
  });

  it("자정 직전 UTC 시각은 브라우저 시간대와 상관없이 그날로 쓴다", () => {
    expect(formatDateTime("es", "2026-12-31T23:59:00Z")).toBe("31 dic, 23:59");
  });

  it("시간 같은 숫자는 소수 둘째 자리까지 그 언어 표기로 쓴다", () => {
    expect(formatNumber("en", 12.5)).toBe("12.5");
    expect(formatNumber("pt", 12.5)).toBe("12,5");
    expect(formatNumber("en", 1 / 3)).toBe("0.33");
  });
});
