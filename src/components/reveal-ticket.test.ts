import { describe, expect, it } from "vitest";
import { isInView, isNewTicket, isTyping, TICKET_HEAD_PX } from "./reveal-ticket";

describe("검토 뒤 새 티켓 찾기", () => {
  it("검토 전에 없던 티켓이 새 티켓이다", () => {
    const before = new Set(["old-1", "old-2"]);

    expect(isNewTicket(before, "new-a")).toBe(true);
    expect(isNewTicket(before, "old-1")).toBe(false);
  });

  it("검토 전에 티켓이 하나도 없었으면 어느 티켓이든 새 티켓이다", () => {
    expect(isNewTicket(new Set(), "only")).toBe(true);
  });

  it("id가 비었거나 없는 티켓은 새 티켓으로 치지 않는다", () => {
    expect(isNewTicket(new Set(["a"]), "")).toBe(false);
    expect(isNewTicket(new Set(["a"]), undefined)).toBe(false);
  });
});

describe("티켓이 화면에 보이는지", () => {
  const phone = { width: 390, height: 844, topInset: 64 };

  it("상단 막대 아래로 머리(번호·상태 줄)가 보이면 보이는 것이다", () => {
    expect(isInView({ top: 120, left: 16, right: 350 }, phone)).toBe(true);
  });

  it("창보다 긴 티켓도 머리가 보이면 보이는 것이다", () => {
    // Its bottom (top + 1200) is far below the window: only the head has to show.
    expect(isInView({ top: 200, left: 16, right: 350 }, phone)).toBe(true);
  });

  it("화면 위로 지나갔으면(휴대폰에서 메시지 칸까지 내려온 상태) 안 보이는 것이다", () => {
    expect(isInView({ top: -900, left: 16, right: 350 }, phone)).toBe(false);
  });

  it("상단 막대에 일부라도 가려지면 안 보이는 것이다", () => {
    expect(isInView({ top: 40, left: 16, right: 350 }, phone)).toBe(false);
  });

  it("머리가 아래로 잘리거나 옆으로 밀려 있으면 안 보이는 것이다", () => {
    expect(isInView({ top: 844 - TICKET_HEAD_PX + 1, left: 16, right: 350 }, phone)).toBe(false);
    expect(isInView({ top: 120, left: 380, right: 720 }, phone)).toBe(false);
    expect(isInView({ top: 120, left: -200, right: 140 }, phone)).toBe(false);
  });

  it("경계에 딱 맞으면 보이는 것이다", () => {
    expect(isInView({ top: 64, left: 0, right: 390 }, phone)).toBe(true);
    expect(isInView({ top: 844 - TICKET_HEAD_PX, left: 0, right: 390 }, phone)).toBe(true);
  });
});

describe("방문자가 글을 쓰는 중인지", () => {
  it("메시지 칸(textarea)에 포커스가 있으면 쓰는 중이라 포커스를 옮기지 않는다", () => {
    expect(isTyping({ tagName: "TEXTAREA" })).toBe(true);
  });

  it("글자를 넣는 input이나 편집 가능한 요소면 쓰는 중이다", () => {
    expect(isTyping({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTyping({ tagName: "INPUT", type: "email" })).toBe(true);
    expect(isTyping({ tagName: "INPUT" })).toBe(true);
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("Check scope 버튼이나 아무 데도 포커스가 없으면 쓰는 중이 아니다", () => {
    expect(isTyping({ tagName: "BUTTON" })).toBe(false);
    expect(isTyping({ tagName: "BODY" })).toBe(false);
    expect(isTyping({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
