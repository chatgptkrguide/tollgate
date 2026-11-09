import { describe, expect, it } from "vitest";
import { firstNewTicketId, isInView } from "./reveal-ticket";

describe("검토 뒤 새 티켓 찾기", () => {
  it("검토 전에 없던 티켓 중 화면 순서로 첫 번째를 고른다", () => {
    const before = new Set(["old-1", "old-2"]);

    expect(firstNewTicketId(before, ["new-a", "new-b", "old-1", "old-2"])).toBe("new-a");
  });

  it("새 티켓이 없으면 null이다", () => {
    expect(firstNewTicketId(new Set(["a", "b"]), ["a", "b"])).toBeNull();
    expect(firstNewTicketId(new Set(), [])).toBeNull();
  });

  it("검토 전에 티켓이 하나도 없었으면 첫 티켓이 새 티켓이다", () => {
    expect(firstNewTicketId(new Set(), ["only"])).toBe("only");
  });

  it("id가 빈 티켓은 건너뛴다", () => {
    expect(firstNewTicketId(new Set(["a"]), ["", "a", "b"])).toBe("b");
  });
});

describe("티켓이 화면에 보이는지", () => {
  const phone = { width: 390, height: 844, topInset: 64 };

  it("상단 막대 아래로 통째로 보이면 보이는 것이다", () => {
    expect(isInView({ top: 120, bottom: 520, left: 16, right: 350 }, phone)).toBe(true);
  });

  it("화면 위로 지나갔으면(휴대폰에서 메시지 칸까지 내려온 상태) 안 보이는 것이다", () => {
    expect(isInView({ top: -900, bottom: -500, left: 16, right: 350 }, phone)).toBe(false);
  });

  it("상단 막대에 일부라도 가려지면 안 보이는 것이다", () => {
    expect(isInView({ top: 40, bottom: 440, left: 16, right: 350 }, phone)).toBe(false);
  });

  it("아래로 잘리거나 옆으로 밀려 있으면 안 보이는 것이다", () => {
    expect(isInView({ top: 600, bottom: 1000, left: 16, right: 350 }, phone)).toBe(false);
    expect(isInView({ top: 120, bottom: 520, left: 380, right: 720 }, phone)).toBe(false);
    expect(isInView({ top: 120, bottom: 520, left: -200, right: 140 }, phone)).toBe(false);
  });

  it("경계에 딱 맞으면 보이는 것이다", () => {
    expect(isInView({ top: 64, bottom: 844, left: 0, right: 390 }, phone)).toBe(true);
  });
});
