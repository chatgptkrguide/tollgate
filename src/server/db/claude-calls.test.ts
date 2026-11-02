import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { takeClaudeCall, type ReviewLimits } from "./claude-calls";
import { createDb, type Db } from "./client";
import { runMigrations } from "./migrate";

const T0 = new Date("2026-11-05T09:00:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const at = (ms: number) => new Date(T0.getTime() + ms);

const limits: ReviewLimits = {
  perCopy: [{ windowMs: DAY, max: 2 }],
  perServer: [
    { windowMs: MINUTE, max: 3 },
    { windowMs: DAY, max: 5 },
  ],
};

describe("Claude 호출 상한", () => {
  let db: Db;

  beforeEach(async () => {
    db = createDb("file::memory:");
    await runMigrations(db);
  });

  it("사본별 상한을 넘으면 거부하고 기록하지 않는다", async () => {
    expect(await takeClaudeCall(db, "a", at(0), limits)).toBe(true);
    expect(await takeClaudeCall(db, "a", at(1000), limits)).toBe(true);
    expect(await takeClaudeCall(db, "a", at(2000), limits)).toBe(false);
    expect(await db.all(sql`SELECT count(*) AS n FROM claude_calls`)).toEqual([{ n: 2 }]);
  });

  it("한 사본이 다 써도 다른 사본은 쓸 수 있다", async () => {
    await takeClaudeCall(db, "a", at(0), limits);
    await takeClaudeCall(db, "a", at(1000), limits);
    expect(await takeClaudeCall(db, "b", at(2000), limits)).toBe(true);
  });

  it("쿠키를 바꿔 사본을 늘려도 서버 전체 분당 상한에 걸린다", async () => {
    for (const copy of ["a", "b", "c"]) expect(await takeClaudeCall(db, copy, at(0), limits)).toBe(true);
    expect(await takeClaudeCall(db, "d", at(1000), limits)).toBe(false);
    expect(await takeClaudeCall(db, "d", at(MINUTE + 1), limits)).toBe(true);
  });

  it("서버 전체 하루 상한에 걸리고 하루가 지나면 풀린다", async () => {
    const copies = ["a", "b", "c", "d", "e"];
    for (const [i, copy] of copies.entries()) expect(await takeClaudeCall(db, copy, at(i * 2 * MINUTE), limits)).toBe(true);
    expect(await takeClaudeCall(db, "f", at(20 * MINUTE), limits)).toBe(false);
    expect(await takeClaudeCall(db, "f", at(DAY + 9 * MINUTE), limits)).toBe(true);
  });

  it("하루 넘은 기록은 지운다", async () => {
    await takeClaudeCall(db, "a", at(0), limits);
    await takeClaudeCall(db, "b", at(DAY + 1), limits);
    expect(await db.all(sql`SELECT project_id FROM claude_calls`)).toEqual([{ project_id: "b" }]);
  });
});
