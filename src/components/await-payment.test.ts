import { describe, expect, it } from "vitest";
import { AWAIT_PAYMENT_EVERY_MS, awaitPaymentPoller, type PollClock } from "./await-payment";

// A hand-driven clock: tick() advances five seconds and runs the timer, if it is still running.
function manualClock() {
  let now = 0;
  let tick: (() => void) | null = null;
  const clock: PollClock = {
    every: (_ms, fn) => {
      tick = fn;
      return () => {
        tick = null;
      };
    },
    nowMs: () => now,
  };
  return {
    clock,
    running: () => tick !== null,
    advance: (times = 1) => {
      for (let i = 0; i < times; i++) {
        now += AWAIT_PAYMENT_EVERY_MS;
        tick?.();
      }
    },
  };
}

describe("결제 기록 뒤 웹훅 기다리기", () => {
  it("5초마다 화면을 다시 읽고, 90초가 지나면 멈춘다", () => {
    const time = manualClock();
    let refreshes = 0;
    awaitPaymentPoller(() => refreshes++, () => false, time.clock);

    time.advance(18); // 90 s
    const at90 = refreshes;
    time.advance(5);

    expect(at90).toBe(18);
    expect(refreshes).toBe(18);
    expect(time.running()).toBe(false);
  });

  it("페이지가 숨겨지면 그 다음 틱에서 다시 읽지 않고 멈춘다", () => {
    const time = manualClock();
    let hidden = false;
    let refreshes = 0;
    awaitPaymentPoller(() => refreshes++, () => hidden, time.clock);

    time.advance(2);
    hidden = true;
    time.advance(1);
    hidden = false;
    time.advance(3);

    expect(refreshes).toBe(2);
    expect(time.running()).toBe(false);
  });

  it("돌려받은 함수로 멈추면(티켓이 결제됨) 더 읽지 않는다", () => {
    const time = manualClock();
    let refreshes = 0;
    const stop = awaitPaymentPoller(() => refreshes++, () => false, time.clock);

    time.advance(1);
    stop();
    time.advance(3);

    expect(refreshes).toBe(1);
    expect(time.running()).toBe(false);
  });
});
