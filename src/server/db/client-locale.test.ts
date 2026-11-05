import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Locale } from "../../i18n/locales";
import { readBillingOrder } from "./change-orders";
import { createDb, type Db } from "./client";
import { readClientLocale, updateClientLocale } from "./client-locale";
import { resetDemoCopy } from "./demo";
import { runMigrations } from "./migrate";
import { changeOrders } from "./schema";

describe("프로젝트 고객 언어 읽기·쓰기", () => {
  let db: Db;

  beforeEach(async () => {
    db = createDb(":memory:");
    await runMigrations(db);
    await resetDemoCopy(db, "p-a", new Date("2026-11-01T00:00:00Z"));
    await resetDemoCopy(db, "p-b", new Date("2026-11-01T00:00:00Z"));
  });

  it("시드 사본은 en이고, 바꾼 값을 그 프로젝트에서만 읽는다", async () => {
    const updated = await updateClientLocale(db, "p-a", "ko");

    expect(updated).toBe(true);
    expect(await readClientLocale(db, "p-a")).toBe("ko");
    expect(await readClientLocale(db, "p-b")).toBe("en");
  });

  it("같은 값을 다시 저장해도 true다", async () => {
    expect(await updateClientLocale(db, "p-a", "en")).toBe(true);
  });

  it("없는 프로젝트는 false이고 읽으면 null이다", async () => {
    expect(await updateClientLocale(db, "p-missing", "ja")).toBe(false);
    expect(await readClientLocale(db, "p-missing")).toBeNull();
  });

  it("목록에 없는 언어는 DB에 닿기 전에 RangeError다", async () => {
    await expect(updateClientLocale(db, "p-a", "fr" as Locale)).rejects.toThrow(RangeError);
    expect(await readClientLocale(db, "p-a")).toBe("en");
  });

  it("청구서를 만들 때 읽는 견적 정보에 프로젝트의 고객 언어가 들어 있다", async () => {
    await updateClientLocale(db, "p-a", "es");
    const [order] = await db.select({ id: changeOrders.id }).from(changeOrders).where(eq(changeOrders.projectId, "p-a"));

    const billing = await readBillingOrder(db, "p-a", order.id);

    expect(billing?.project.clientLocale).toBe("es");
  });
});
