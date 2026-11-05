import { describe, expect, it, vi } from "vitest";
import { RETURN_REFRESH_MIN_GAP_MS, returnRefresher } from "./return-refresh";

describe("탭으로 돌아올 때 새로고침", () => {
  it("탭이 보이게 되면 새로고침하고, 숨겨질 때는 하지 않는다", () => {
    const refresh = vi.fn();
    const onReturn = returnRefresher(refresh, () => 1_000);

    onReturn("hidden");
    onReturn("visible");

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("5초 안에 다시 돌아오면 한 번만 새로고침하고, 5초가 지나면 다시 한다", () => {
    const refresh = vi.fn();
    let now = 10_000;
    const onReturn = returnRefresher(refresh, () => now);

    onReturn("visible");
    now += RETURN_REFRESH_MIN_GAP_MS - 1;
    onReturn("visible");
    now += 1;
    onReturn("visible");

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("시계가 0에서 시작해도 첫 복귀는 새로고침한다", () => {
    const refresh = vi.fn();

    returnRefresher(refresh, () => 0)("visible");

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
