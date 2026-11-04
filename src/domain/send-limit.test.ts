import { describe, expect, it } from "vitest";
import { SEND_LIMITS, SEND_LIMITS_PER_COPY } from "./send-limit";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// How the limits are counted is tested with the table that counts them (server/db/paypal-sends.test.ts).
describe("발송 상한 (P2-S1·P2-S5)", () => {
  it("서버 전체 상한은 분당 10건·하루 200건이다", () => {
    expect(SEND_LIMITS.map((limit) => [limit.windowMs, limit.max])).toEqual([
      [MINUTE, 10],
      [DAY, 200],
    ]);
  });

  it("사본별 상한은 하루 20건이라 서버 하루 상한을 다 쓰려면 사본 10개가 필요하다", () => {
    expect(SEND_LIMITS_PER_COPY.map((limit) => [limit.windowMs, limit.max])).toEqual([[DAY, 20]]);
    expect(SEND_LIMITS[1].max / SEND_LIMITS_PER_COPY[0].max).toBe(10);
  });
});
