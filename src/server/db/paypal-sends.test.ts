import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { deleteExpiredCopies, ensureDemoCopy, resetDemoCopy } from "./demo";
import { runMigrations } from "./migrate";
import { takePayPalSend } from "./paypal-sends";
import { changeOrders, paypalSends, projects } from "./schema";

const T0 = new Date("2026-11-01T09:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
const at = (ms: number) => new Date(T0.getTime() + ms);

// The server-wide cap counted alone: every send comes from a copy of its own, so no copy reaches its cap.
const takeServer = async (db: Db, changeOrderId: string, when: Date) => (await takePayPalSend(db, `copy-of-${changeOrderId}`, changeOrderId, when)) === "taken";

describe("발송 기록 표: 서버 전체·사본별 상한 (P2-S1b·P2-S5)", () => {
  let dir: string;
  let url: string;
  let db: Db;
  const opened: Db[] = [];

  // A file database, so a second connection (another request or a restarted process) sees the same rows.
  const connect = (): Db => {
    const connection = createDb(url);
    opened.push(connection);
    return connection;
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "tollgate-sends-"));
    url = `file:${join(dir, "tollgate.db")}`;
    db = connect();
    await runMigrations(db);
  });

  afterEach(() => {
    for (const connection of opened.splice(0)) connection.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const draftOf = async (projectId: string) =>
    (await db.select().from(changeOrders).where(and(eq(changeOrders.projectId, projectId), eq(changeOrders.status, "draft"))))[0].id;
  const rowCount = async (connection: Db = db) => (await connection.select().from(paypalSends)).length;

  it("발송·재설정을 반복해도 발송 기록 표로 분당 10건 상한이 유지된다", async () => {
    const { projectId } = await ensureDemoCopy(db, "visitor-loop", T0);
    const taken = [];

    for (let i = 0; i < 11; i++) {
      taken.push((await takePayPalSend(db, projectId, await draftOf(projectId), at(i * SECOND))) === "taken");
      await resetDemoCopy(db, projectId, at(i * SECOND)); // a new draft id and no activity rows
    }

    expect(taken).toEqual([...Array(10).fill(true), false]);
    expect(await rowCount()).toBe(10);
  });

  it("재설정과 7일 정리는 발송 기록 표를 지우지 않는다", async () => {
    const { projectId } = await ensureDemoCopy(db, "visitor-old", T0);
    for (let i = 0; i < 3; i++) await takePayPalSend(db, projectId, await draftOf(projectId), at(i * SECOND));

    await resetDemoCopy(db, projectId, at(10 * SECOND));
    const removed = await deleteExpiredCopies(db, at(8 * DAY));

    expect(removed).toBe(1);
    expect(await db.select().from(projects)).toEqual([]);
    expect(await rowCount()).toBe(3);
  });

  it("새 DB 연결(재시작)에서도 표에 남은 기록으로 상한이 유지된다", async () => {
    for (let i = 0; i < 10; i++) await takeServer(db, `order-${i}`, at(i * SECOND));
    db.$client.close();

    const restarted = connect();
    const afterRestart = await takeServer(restarted, "order-10", at(11 * SECOND));

    expect(afterRestart).toBe(false);
    expect(await rowCount(restarted)).toBe(10);
  });

  it("서로 다른 DB 연결 둘이 동시에 마지막 한 자리를 다투면 하나만 가져간다", async () => {
    for (let i = 0; i < 9; i++) await takeServer(db, `order-${i}`, at(i * SECOND));
    const [first, second] = [connect(), connect()];

    const results = await Promise.all([
      takeServer(first, "order-a", at(10 * SECOND)),
      takeServer(second, "order-b", at(10 * SECOND)),
      takeServer(first, "order-c", at(10 * SECOND)),
      takeServer(second, "order-d", at(10 * SECOND)),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await rowCount()).toBe(10);
  });

  it("하루가 지난 기록은 다음 발송 때 지워진다", async () => {
    await takeServer(db, "order-old", T0);
    await takeServer(db, "order-mid", at(DAY / 2));

    const taken = await takeServer(db, "order-new", at(DAY));

    expect(taken).toBe(true);
    expect((await db.select().from(paypalSends)).map((r) => r.changeOrderId)).toEqual(["order-mid", "order-new"]);
  });

  it("1분이 지나면 분당 상한이 풀린다", async () => {
    for (let i = 0; i < 10; i++) await takeServer(db, `order-${i}`, at(i * SECOND));

    const justBefore = await takeServer(db, "order-10", at(MINUTE - 1));
    const firstOutOfWindow = await takeServer(db, "order-11", at(MINUTE));
    const stillFull = await takeServer(db, "order-12", at(MINUTE));

    expect([justBefore, firstOutOfWindow, stillFull]).toEqual([false, true, false]);
  });

  it("하루 200건을 넘으면 분당 여유가 있어도 거부하고, 거부한 요청은 기록하지 않는다", async () => {
    const taken = [];
    for (let i = 0; i < 200; i++) taken.push(await takeServer(db, `order-${i}`, at(i * 7 * SECOND))); // at most 9 a minute

    const overDaily = await takeServer(db, "order-200", at(200 * 7 * SECOND));

    expect(taken.every(Boolean)).toBe(true);
    expect(overDaily).toBe(false);
    expect(await rowCount()).toBe(200);
  });

  describe("사본별 상한 (P2-S5)", () => {
    // Seven seconds apart: at most nine a minute, so the server's per-minute cap never answers first.
    const spaced = (i: number) => at(i * 7 * SECOND);

    it("한 사본이 하루 20건을 보내면 21번째는 copy_full로 거부하지만 다른 사본은 계속 보낼 수 있다", async () => {
      const results = [];
      for (let i = 0; i < 21; i++) results.push(await takePayPalSend(db, "copy-a", `a-${i}`, spaced(i)));

      const other = await takePayPalSend(db, "copy-b", "b-0", spaced(21));

      expect(results.slice(0, 20)).toEqual(Array(20).fill("taken"));
      expect(results[20]).toBe("copy_full");
      expect(other).toBe("taken");
      expect(await rowCount()).toBe(21);
    });

    it("재설정해도 사본의 남은 발송 수는 돌아오지 않는다", async () => {
      const { projectId } = await ensureDemoCopy(db, "visitor-reset", T0);
      for (let i = 0; i < 20; i++) await takePayPalSend(db, projectId, `old-${i}`, spaced(i));

      expect(await resetDemoCopy(db, projectId, spaced(20))).toBe("reset");
      const afterReset = await takePayPalSend(db, projectId, await draftOf(projectId), spaced(21));

      expect(afterReset).toBe("copy_full");
      expect(await rowCount()).toBe(20);
    });

    it("재시작(새 DB 연결) 뒤에도 사본별 상한이 유지된다", async () => {
      for (let i = 0; i < 20; i++) await takePayPalSend(db, "copy-a", `a-${i}`, spaced(i));
      db.$client.close();

      const restarted = connect();

      expect(await takePayPalSend(restarted, "copy-a", "a-20", spaced(20))).toBe("copy_full");
    });

    it("사본 상한은 24시간 창이라 첫 발송에서 하루가 지나면 한 건씩 다시 열린다", async () => {
      for (let i = 0; i < 20; i++) await takePayPalSend(db, "copy-a", `a-${i}`, spaced(i));

      const justBefore = await takePayPalSend(db, "copy-a", "a-20", at(DAY - 1));
      const afterFirstExpires = await takePayPalSend(db, "copy-a", "a-21", at(DAY));
      const stillFull = await takePayPalSend(db, "copy-a", "a-22", at(DAY));

      expect([justBefore, afterFirstExpires, stillFull]).toEqual(["copy_full", "taken", "copy_full"]);
    });

    it("사본에 여유가 있는데 서버 상한에 걸리면 server_full이다", async () => {
      for (let i = 0; i < 10; i++) await takeServer(db, `order-${i}`, at(i * SECOND));

      expect(await takePayPalSend(db, "copy-new", "order-10", at(10 * SECOND))).toBe("server_full");
    });

    it("사본과 서버가 둘 다 찼으면 사본 상한으로 답한다", async () => {
      for (let i = 0; i < 20; i++) await takePayPalSend(db, "copy-a", `a-${i}`, spaced(i));
      for (let i = 0; i < 10; i++) await takeServer(db, `order-${i}`, at(DAY / 2 + i * SECOND));

      expect(await takePayPalSend(db, "copy-a", "a-20", at(DAY / 2 + 10 * SECOND))).toBe("copy_full");
    });

    it("발송 기록에 보낸 사본이 남는다", async () => {
      await takePayPalSend(db, "copy-a", "a-0", T0);

      const rows = await db.select({ projectId: paypalSends.projectId, changeOrderId: paypalSends.changeOrderId }).from(paypalSends);

      expect(rows).toEqual([{ projectId: "copy-a", changeOrderId: "a-0" }]);
    });
  });
});
