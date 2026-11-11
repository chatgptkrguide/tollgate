import { describe, expect, it } from "vitest";
import type { ChangeOrderStatus } from "@/domain/types";
import { actionFirst } from "./ticket-order";

const entry = (id: string, status: ChangeOrderStatus) => ({ id, order: { status } });
const ids = (entries: readonly { id: string }[]) => entries.map((e) => e.id);

describe("티켓 순서: 할 일 먼저", () => {
  it("초안이 먼저, 그다음 보냈지만 안 받은 것, 그다음 결제·무료·취소가 온다", () => {
    const entries = [entry("paid", "paid"), entry("sent", "sent"), entry("waived", "waived"), entry("draft", "draft"), entry("cancelled", "cancelled")];

    const sorted = actionFirst(entries);

    expect(ids(sorted)).toEqual(["draft", "sent", "paid", "waived", "cancelled"]);
  });

  it("같은 묶음 안에서는 들어온 순서(최신 메시지 먼저)를 그대로 둔다", () => {
    const entries = [entry("done-new", "paid"), entry("draft-new", "draft"), entry("done-old", "waived"), entry("draft-old", "draft")];

    const sorted = actionFirst(entries);

    expect(ids(sorted)).toEqual(["draft-new", "draft-old", "done-new", "done-old"]);
  });

  it("시드처럼 최신 메시지의 초안이 이미 맨 앞이면 순서가 바뀌지 않는다", () => {
    const entries = [entry("loyalty", "draft"), entry("gift-card", "paid")];

    expect(ids(actionFirst(entries))).toEqual(["loyalty", "gift-card"]);
  });

  it("받은 배열은 바꾸지 않고, 빈 목록은 빈 목록을 돌려준다", () => {
    const entries = [entry("paid", "paid"), entry("draft", "draft")];

    actionFirst(entries);

    expect(ids(entries)).toEqual(["paid", "draft"]);
    expect(actionFirst([])).toEqual([]);
  });
});
