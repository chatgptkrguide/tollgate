import { describe, expect, it } from "vitest";
import { addDays, deliveryPlan, paymentUnlock, type DeliveryOrder } from "./delivery";
import type { ChangeOrderStatus } from "./types";

const LAUNCH = "2026-11-15";

function order(id: string, status: ChangeOrderStatus, extraDays: number, paidAt: string | null = null): DeliveryOrder {
  return { id, title: `${id} page`, status, extraDays, paidAt: status === "paid" ? (paidAt ?? "2026-10-26T10:00:00Z") : null };
}

describe("날짜 더하기", () => {
  it("UTC 기준으로 날짜만 더하고 달이 바뀌어도 맞다", () => {
    expect(addDays("2026-11-15", 3)).toBe("2026-11-18");
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("소수 일수는 올림하고 0 이하·숫자가 아닌 값은 더하지 않는다", () => {
    expect(addDays(LAUNCH, 0.2)).toBe("2026-11-16");
    expect(addDays(LAUNCH, 0)).toBe(LAUNCH);
    expect(addDays(LAUNCH, -2)).toBe(LAUNCH);
    expect(addDays(LAUNCH, Number.NaN)).toBe(LAUNCH);
  });

  it("YYYY-MM-DD가 아닌 값은 받은 글자를 그대로 돌려준다", () => {
    expect(addDays("not a date", 2)).toBe("not a date");
  });
});

describe("납품 일정", () => {
  it("견적이 없으면 출시일은 합의한 날 그대로이고 행이 없다", () => {
    const plan = deliveryPlan(LAUNCH, []);

    expect(plan).toEqual({ agreedLaunch: LAUNCH, launch: LAUNCH, moved: false, rows: [], lockedDays: 0, launchIfPaid: LAUNCH });
  });

  it("시드 상태면 결제된 기프트카드 1일만 더해 Nov 16이 되고 초안 로열티 3일은 잠긴 채 세지 않는다", () => {
    const plan = deliveryPlan(LAUNCH, [order("gift", "paid", 1), order("loyalty", "draft", 3)]);

    expect(plan.launch).toBe("2026-11-16");
    expect(plan.moved).toBe(true);
    expect(plan.lockedDays).toBe(3);
    expect(plan.launchIfPaid).toBe("2026-11-19");
    expect(plan.rows).toEqual([
      { orderId: "gift", title: "gift page", days: 1, state: "unlocked", unlockedAt: "2026-10-26T10:00:00Z" },
      { orderId: "loyalty", title: "loyalty page", days: 3, state: "locked", unlockedAt: null },
    ]);
  });

  it("보낸 견적도 결제 전까지 잠겨 있다", () => {
    const plan = deliveryPlan(LAUNCH, [order("loyalty", "sent", 3)]);

    expect(plan.rows[0].state).toBe("locked");
    expect(plan.launch).toBe(LAUNCH);
    expect(plan.moved).toBe(false);
  });

  it("무료 처리한 견적은 포함으로 풀려 일수를 더하고, 취소한 견적은 행도 일수도 없다", () => {
    const plan = deliveryPlan(LAUNCH, [order("gift", "waived", 2), order("loyalty", "cancelled", 3)]);

    expect(plan.rows.map((r) => [r.orderId, r.state, r.unlockedAt])).toEqual([["gift", "included", null]]);
    expect(plan.launch).toBe("2026-11-17");
    expect(plan.lockedDays).toBe(0);
  });

  it("행은 받은 순서를 지키고 출시일은 순서와 상관없다", () => {
    const orders = [order("a", "draft", 1), order("b", "paid", 2), order("c", "waived", 1), order("d", "cancelled", 5)];

    const forward = deliveryPlan(LAUNCH, orders);
    const backward = deliveryPlan(LAUNCH, [...orders].reverse());

    expect(forward.rows.map((r) => r.orderId)).toEqual(["a", "b", "c"]);
    expect(backward.rows.map((r) => r.orderId)).toEqual(["c", "b", "a"]);
    expect(forward.launch).toBe("2026-11-18");
    expect(backward.launch).toBe(forward.launch);
  });

  it("행마다 소수 일수를 올림한 뒤 더한다", () => {
    const plan = deliveryPlan(LAUNCH, [order("a", "paid", 0.5), order("b", "paid", 1.2), order("c", "draft", 0.1)]);

    expect(plan.rows.map((r) => r.days)).toEqual([1, 2, 1]);
    expect(plan.launch).toBe("2026-11-18");
    expect(plan.lockedDays).toBe(1);
  });

  it("일수가 0인 견적은 결제돼도 출시일을 옮기지 않는다", () => {
    const plan = deliveryPlan(LAUNCH, [order("a", "paid", 0)]);

    expect(plan.launch).toBe(LAUNCH);
    expect(plan.moved).toBe(false);
    expect(plan.rows[0].state).toBe("unlocked");
  });
});

describe("결제로 풀리는 작업", () => {
  const seeded = [order("gift", "paid", 1), order("loyalty", "sent", 3)];

  it("로열티가 결제되면 풀린 행과 Nov 19 출시일, 작업 기록 한 줄을 돌려준다", () => {
    const unlock = paymentUnlock(LAUNCH, seeded, "loyalty", "2026-11-05T09:00:00Z");

    expect(unlock?.row).toEqual({ orderId: "loyalty", title: "loyalty page", days: 3, state: "unlocked", unlockedAt: "2026-11-05T09:00:00Z" });
    expect(unlock?.plan.launch).toBe("2026-11-19");
    expect(unlock?.plan.lockedDays).toBe(0);
    expect(unlock?.summary).toBe("Payment unlocked “loyalty page”; launch moves to Nov 19.");
  });

  it("일수가 0인 견적이 결제되면 출시일이 그대로라고 쓴다", () => {
    const unlock = paymentUnlock(LAUNCH, [order("gift", "paid", 1), order("tiny", "draft", 0)], "tiny", "2026-11-05T09:00:00Z");

    expect(unlock?.summary).toBe("Payment unlocked “tiny page”; launch stays Nov 16.");
  });

  it("목록에 없거나 취소된 견적이면 null이다", () => {
    expect(paymentUnlock(LAUNCH, seeded, "missing", "2026-11-05T09:00:00Z")).toBeNull();
    expect(paymentUnlock(LAUNCH, [order("gone", "cancelled", 2)], "gone", "2026-11-05T09:00:00Z")).toBeNull();
  });
});
