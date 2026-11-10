import { describe, expect, it } from "vitest";
import { GUIDE_COOKIE, guideCookie, isGuideOpen } from "./guide-state";

describe("데모 안내의 펼침 기억", () => {
  it("방문자가 펼쳐 둔 경우에만 펼친 채로 그린다", () => {
    expect(isGuideOpen("open")).toBe(true);
    expect(isGuideOpen("closed")).toBe(false);
    expect(isGuideOpen(undefined)).toBe(false);
    expect(isGuideOpen("OPEN")).toBe(false);
  });

  it("쿠키 문자열은 사이트 전체에 1년 동안 남고, 읽으면 같은 선택으로 돌아온다", () => {
    const opened = guideCookie(true);
    const closed = guideCookie(false);

    expect(opened).toBe(`${GUIDE_COOKIE}=open; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(isGuideOpen(opened.split(";")[0].split("=")[1])).toBe(true);
    expect(isGuideOpen(closed.split(";")[0].split("=")[1])).toBe(false);
  });
});
