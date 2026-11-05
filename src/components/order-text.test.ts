import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tRich } from "@/i18n/t";
import { effortLine, statusLine, statusText } from "./order-text";
import { Rich } from "./Rich";

describe("티켓 글자: 상태 줄", () => {
  it("영어 상태 글자는 바꾸기 전과 똑같다", () => {
    const texts = (["draft", "sent", "paid", "waived", "cancelled"] as const).map((status) => statusText("en", status));

    expect(texts).toEqual(["Not sent yet", "Sent to client, not paid yet", "Paid", "Included at no charge", "Cancelled"]);
  });

  it("결제일이 있으면 그 언어의 날짜와 함께 쓴다", () => {
    const order = { status: "paid", paidAt: "2026-11-05T09:00:00Z" } as const;

    expect(statusLine("en", order)).toBe("Paid Nov 5");
    expect(statusLine("ko", order)).toBe("11월 5일 결제 완료");
  });

  it("결제일이 없는 결제 완료는 날짜 없이 쓴다", () => {
    expect(statusLine("ja", { status: "paid", paidAt: null })).toBe("支払い済み");
  });
});

describe("티켓 글자: 시간과 날짜 줄", () => {
  it("영어는 전과 같이 소수 한 자리 시간과 +일수를 쓴다", () => {
    expect(effortLine("en", 8.66, 3)).toBe("≈ 8.7 h · +3 days");
    expect(effortLine("en", 13, 1)).toBe("≈ 13 h · +1 day");
  });

  it("다른 언어는 그 언어의 단위와 소수점을 쓴다", () => {
    expect(effortLine("ko", 13, 3)).toBe("≈ 13시간 · +3일");
    expect(effortLine("pt", 12.5, 2)).toBe("≈ 12,5 h · +2 dias");
  });

  it("0일이어도 복수형으로 쓴다", () => {
    expect(effortLine("en", 0.5, 0)).toBe("≈ 0.5 h · +0 days");
  });
});

describe("Rich: 표시가 든 번역 글", () => {
  it("<b>는 굵게, <sr>는 화면 읽기 전용, 나머지는 글자 그대로 그린다", () => {
    const parts = tRich("en", "conversation.title", { client: "Harbor & Pine" });

    const html = renderToStaticMarkup(createElement(Rich, { parts }));

    expect(html).toBe('Conversation<span class="sr-only"> with Harbor &amp; Pine</span>');
  });

  it("<link>는 넘긴 함수로 그리고, 함수가 없으면 글자만 남긴다", () => {
    const parts = tRich("en", "guide.step1Target", { author: "Maya", sentOn: "Oct 28" });
    const link = (text: string) => createElement("a", { href: "#note" }, text);

    const withLink = renderToStaticMarkup(createElement(Rich, { parts, link }));
    const withoutLink = renderToStaticMarkup(createElement(Rich, { parts }));

    expect(withLink).toContain('<a href="#note">marked request</a>');
    expect(withoutLink).toContain("a marked request — start");
    expect(withoutLink).not.toContain("<a");
  });

  it("<nowrap>은 줄바꿈하지 않는 span으로, <b>는 받은 class로 그린다", () => {
    const nowrap = renderToStaticMarkup(createElement(Rich, { parts: tRich("en", "delivery.launchIfPaid", { date: "Nov 19" }) }));
    const bold = renderToStaticMarkup(createElement(Rich, { parts: tRich("ko", "delivery.roadLaunch", { date: "11월 15일" }), boldClassName: "font-semibold" }));

    expect(nowrap).toBe('Paying the locked work moves the launch to <span class="whitespace-nowrap">Nov 19.</span>');
    expect(bold).toBe('출시 <b class="font-semibold">11월 15일</b>');
  });
});
