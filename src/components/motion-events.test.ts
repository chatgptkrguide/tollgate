import { describe, expect, it } from "vitest";
import { motionEvents, parseSnapshot, type SeenSnapshot } from "./motion-events";

const base: SeenSnapshot = { orders: { a: "sent", b: "paid" }, activity: 4, launch: "2026-11-16" };

describe("motionEvents", () => {
  it("처음 보는 탭(저장된 스냅샷 없음)에서는 아무 효과도 재생하지 않는다", () => {
    // Arrange
    const now: SeenSnapshot = { orders: { a: "paid" }, activity: 9, launch: "2026-11-19" };

    // Act
    const events = motionEvents(null, now);

    // Assert
    expect(events).toEqual({ lift: [], paid: false, print: [], activityAfter: null, launchMoved: false });
  });

  it("보낸 견적이 결제되면 그 견적의 차단기가 올라가고 합계가 정산되며 출시일이 넘어간다", () => {
    const now: SeenSnapshot = { orders: { a: "paid", b: "paid" }, activity: 6, launch: "2026-11-19" };

    const events = motionEvents(base, now);

    expect(events.lift).toEqual(["a"]);
    expect(events.paid).toBe(true);
    expect(events.launchMoved).toBe(true);
    expect(events.activityAfter).toBe(4);
  });

  it("초안을 무료로 포함하면 차단기는 열리지만 결제 정산(paid)은 아니다", () => {
    const before: SeenSnapshot = { orders: { c: "draft" }, activity: 0, launch: "2026-11-15" };

    const events = motionEvents(before, { orders: { c: "waived" }, activity: 0, launch: "2026-11-18" });

    expect(events.lift).toEqual(["c"]);
    expect(events.paid).toBe(false);
    expect(events.activityAfter).toBeNull();
  });

  it("이미 결제된 견적이나 그대로인 견적은 다시 재생하지 않는다", () => {
    const events = motionEvents(base, base);

    expect(events.lift).toEqual([]);
    expect(events.print).toEqual([]);
    expect(events.launchMoved).toBe(false);
  });

  it("새로 생긴 초안 견적만 인쇄 효과를 받고, 새로 생긴 결제 견적은 받지 않는다", () => {
    const now: SeenSnapshot = { orders: { ...base.orders, d: "draft", e: "paid" }, activity: 4, launch: base.launch };

    const events = motionEvents(base, now);

    expect(events.print).toEqual(["d"]);
    expect(events.lift).toEqual([]);
  });

  it("취소된 견적이 결제로 바뀌는 일은 차단기 효과로 치지 않는다", () => {
    const events = motionEvents({ ...base, orders: { a: "cancelled" } }, { ...base, orders: { a: "paid" } });

    expect(events.lift).toEqual([]);
  });
});

describe("parseSnapshot", () => {
  it("저장한 스냅샷을 그대로 읽는다", () => {
    expect(parseSnapshot(JSON.stringify(base))).toEqual(base);
  });

  it("깨진 값이나 형식이 다른 값은 없음(null)으로 본다", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("{not json")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ orders: {}, activity: "4", launch: "x" }))).toBeNull();
    expect(parseSnapshot("[]")).toBeNull();
  });

  it("모르는 상태 값은 빼고 읽는다", () => {
    const parsed = parseSnapshot(JSON.stringify({ orders: { a: "paid", b: "stolen" }, activity: 1, launch: "2026-11-15" }));

    expect(parsed?.orders).toEqual({ a: "paid" });
  });
});
