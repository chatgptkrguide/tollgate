import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INVOICE_ID, PAYER_VIEW_URL } from "../../test/paypal-fixtures";
import { listActivity } from "./db/activity";
import { createDb, type Db } from "./db/client";
import { ensureDemoCopy, resetDemoCopy } from "./db/demo";
import { runMigrations } from "./db/migrate";
import { changeOrders, sandboxPayments } from "./db/schema";
import { PayPalError } from "./paypal/errors";
import type { InvoiceView, RecordedPayment } from "./paypal/invoices";
import type { PayPalEnvironment } from "./paypal/token";
import { SANDBOX_PAYMENT_NOTE, simulateOwnedPayment, type SandboxPayPal, type SandboxPaymentDeps } from "./sandbox-payment";

const T0 = new Date("2026-11-10T07:30:00.000Z");

interface FakeOptions {
  environment?: PayPalEnvironment;
  views?: readonly (InvoiceView | PayPalError)[]; // one per get(), the last one repeats
  record?: () => Promise<"recorded" | "not_payable">;
}

// A PayPal stand-in that remembers every call.
function fakePayPal(options: FakeOptions) {
  const gets: string[] = [];
  const records: { invoiceId: string; payment: RecordedPayment }[] = [];
  const views = options.views ?? [];
  const paypal: SandboxPayPal = {
    environment: options.environment ?? "sandbox",
    get: async (invoiceId) => {
      gets.push(invoiceId);
      const view = views[Math.min(gets.length - 1, views.length - 1)];
      if (view instanceof PayPalError) throw view;
      return view;
    },
    recordPayment: async (invoiceId, payment) => {
      records.push({ invoiceId, payment });
      return options.record ? options.record() : "recorded";
    },
  };
  return { paypal, gets, records };
}

describe("결제 시뮬레이션 (샌드박스)", () => {
  let db: Db;
  let mine: string;
  let theirs: string;
  let orderId: string;

  const invoiceView = (status: string, overrides: Partial<InvoiceView> = {}): InvoiceView => ({
    id: INVOICE_ID,
    status,
    invoiceNumber: "TG-4ILUBN7LCCN6SKDSN5C15S",
    reference: orderId,
    amountValue: "650.00",
    currencyCode: "USD",
    payerViewUrl: PAYER_VIEW_URL,
    ...overrides,
  });

  const markSent = async (projectId: string): Promise<string> => {
    const [draft] = await db.select().from(changeOrders).where(and(eq(changeOrders.projectId, projectId), eq(changeOrders.status, "draft")));
    await db.update(changeOrders).set({ status: "sent", paypalInvoiceId: INVOICE_ID, sentAt: "2026-11-10T07:00:00.000Z", payerViewUrl: PAYER_VIEW_URL }).where(eq(changeOrders.id, draft.id));
    return draft.id;
  };

  beforeEach(async () => {
    db = createDb(":memory:");
    await runMigrations(db);
    mine = (await ensureDemoCopy(db, "visitor-a", T0)).projectId;
    theirs = (await ensureDemoCopy(db, "visitor-b", T0)).projectId;
    orderId = await markSent(mine);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  const deps = (paypal: SandboxPayPal | null, now = () => T0): SandboxPaymentDeps => ({ db, paypal, now });
  const order = async () => (await db.select().from(changeOrders).where(eq(changeOrders.id, orderId)))[0];
  const steps = async () => (await listActivity(db, mine)).filter((e) => e.changeOrderId === orderId);
  const placesTaken = async () => (await db.select().from(sandboxPayments)).length;

  it("보낸 견적이면 청구서를 읽고 전액을 오늘 날짜·PAYPAL 방식으로 기록하고, 견적은 sent로 둔 채 활동 한 줄을 남긴다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT")] });
    const before = await order();

    const result = await simulateOwnedPayment(deps(pp.paypal), mine, orderId);

    expect(result).toEqual({ ok: true });
    expect(pp.gets).toEqual([INVOICE_ID]);
    expect(pp.records).toEqual([{ invoiceId: INVOICE_ID, payment: { amountValue: "650.00", date: "2026-11-10", note: SANDBOX_PAYMENT_NOTE } }]);
    expect(await order()).toEqual(before); // never marked paid here: the webhook or Check payment does that
    const [step] = await steps();
    expect(step).toMatchObject({
      kind: "payment_recorded",
      actor: "paypal",
      summary: "Recorded a sandbox payment on invoice TG-4ILUBN7LCCN6SKDSN5C15S through PayPal's API, as if the client paid. Waiting for PayPal's webhook.",
      detail: { invoiceId: INVOICE_ID, amount: "650.00", currency: "USD", method: "PAYPAL", sandbox: true },
    });
    expect(await placesTaken()).toBe(1);
  });

  it("다른 사본의 견적 id면 not_found이고 PayPal을 부르지 않는다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT")] });

    const result = await simulateOwnedPayment(deps(pp.paypal), theirs, orderId);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(pp.gets).toEqual([]);
    expect(pp.records).toEqual([]);
  });

  it("live PayPal이면 sandbox_only이고 DB도 PayPal도 건드리지 않는다", async () => {
    const pp = fakePayPal({ environment: "live", views: [invoiceView("SENT")] });

    const result = await simulateOwnedPayment(deps(pp.paypal), mine, orderId);

    expect(result).toEqual({ ok: false, error: "sandbox_only" });
    expect([pp.gets, pp.records]).toEqual([[], []]);
    expect(await placesTaken()).toBe(0);
  });

  it("PayPal 키가 없으면 not_configured다", async () => {
    expect(await simulateOwnedPayment(deps(null), mine, orderId)).toEqual({ ok: false, error: "not_configured" });
  });

  it("초안·결제된 견적에는 기록하지 않는다(invalid_state·already_paid)", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT")] });
    const [draft] = await db.select().from(changeOrders).where(and(eq(changeOrders.projectId, theirs), eq(changeOrders.status, "draft")));
    const [paid] = await db.select().from(changeOrders).where(and(eq(changeOrders.projectId, mine), eq(changeOrders.status, "paid")));

    const results = [await simulateOwnedPayment(deps(pp.paypal), theirs, draft.id), await simulateOwnedPayment(deps(pp.paypal), mine, paid.id)];

    expect(results).toEqual([
      { ok: false, error: "invalid_state" },
      { ok: false, error: "already_paid" },
    ]);
    expect(pp.records).toEqual([]);
  });

  it.each(["PAID", "MARKED_AS_PAID"])("PayPal이 이미 %s면 두 번째 결제를 기록하지 않고 already_paid로 답하며 한도도 쓰지 않는다", async (status) => {
    const pp = fakePayPal({ views: [invoiceView(status)] });

    const result = await simulateOwnedPayment(deps(pp.paypal), mine, orderId);

    expect(result).toEqual({ ok: false, error: "already_paid" });
    expect(pp.records).toEqual([]);
    expect((await order()).status).toBe("sent");
    expect(await placesTaken()).toBe(0);
  });

  it("동시에 누른 다른 요청이 먼저 기록해 PayPal이 CANNOT_PROCESS_PAYMENTS로 답하면, 다시 읽어 already_paid로 답한다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT"), invoiceView("MARKED_AS_PAID")], record: async () => "not_payable" });

    const result = await simulateOwnedPayment(deps(pp.paypal), mine, orderId);

    expect(result).toEqual({ ok: false, error: "already_paid" });
    expect(pp.gets).toHaveLength(2);
    expect(await steps()).toEqual([]);
  });

  it.each(["PARTIALLY_PAID", "PAYMENT_PENDING", "CANCELLED"])("PayPal이 %s면 not_payable이고 기록하지 않는다", async (status) => {
    const pp = fakePayPal({ views: [invoiceView(status)] });

    expect(await simulateOwnedPayment(deps(pp.paypal), mine, orderId)).toEqual({ ok: false, error: "not_payable" });
    expect(pp.records).toEqual([]);
  });

  it("청구서 금액·참조가 견적과 다르면 invoice_changed이고 기록하지 않는다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT", { amountValue: "1.00" })] });

    expect(await simulateOwnedPayment(deps(pp.paypal), mine, orderId)).toEqual({ ok: false, error: "invoice_changed" });
    expect(pp.records).toEqual([]);
  });

  it("청구서 읽기 실패는 paypal_unavailable, 기록 거절은 paypal_rejected로 답하고 paypal_failed 단계를 남긴다", async () => {
    const down = fakePayPal({ views: [new PayPalError("unavailable", 503, null, "dbg1")] });
    const refused = fakePayPal({ views: [invoiceView("SENT")], record: async () => Promise.reject(new PayPalError("rejected", 400, "INVALID_REQUEST", "dbg2")) });

    const results = [await simulateOwnedPayment(deps(down.paypal), mine, orderId), await simulateOwnedPayment(deps(refused.paypal), mine, orderId)];

    expect(results).toEqual([
      { ok: false, error: "paypal_unavailable" },
      { ok: false, error: "paypal_rejected" },
    ]);
    const failed = await steps();
    expect(failed.map((e) => [e.kind, e.detail?.step])).toEqual([
      ["paypal_failed", "read"],
      ["paypal_failed", "record"],
    ]);
    expect(failed[1].summary).toBe("PayPal refused the request while recording the sandbox payment (INVALID_REQUEST); no payment was recorded.");
    expect((await order()).status).toBe("sent");
  });

  it("PayPal 오류가 아닌 예외는 그대로 던진다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT")], record: async () => Promise.reject(new TypeError("boom")) });

    await expect(simulateOwnedPayment(deps(pp.paypal), mine, orderId)).rejects.toThrow("boom");
  });

  it("사본마다 24시간에 5번까지이고, 재설정해도 늘지 않으며, 하루가 지나면 다시 된다", async () => {
    const pp = fakePayPal({ views: [invoiceView("SENT")] });
    const at = (ms: number) => () => new Date(T0.getTime() + ms);
    const results = [];

    for (let i = 0; i < 5; i++) results.push(await simulateOwnedPayment(deps(pp.paypal, at(i * 1000)), mine, orderId));
    await resetDemoCopy(db, mine, T0); // refused (invoice open) or not, the count stays
    const sixth = await simulateOwnedPayment(deps(pp.paypal, at(10_000)), mine, orderId);
    const nextDay = await simulateOwnedPayment(deps(pp.paypal, at(24 * 60 * 60 * 1000 + 1000)), mine, orderId);

    expect(results).toEqual(Array(5).fill({ ok: true }));
    expect(sixth).toEqual({ ok: false, error: "copy_rate_limited" });
    expect(nextDay).toEqual({ ok: true });
    expect(pp.records).toHaveLength(6);
  });

  it("서버 전체로 하루 100번이 차면 rate_limited이고 PayPal에 기록하지 않는다", async () => {
    for (let i = 0; i < 100; i++) {
      await db.run(sql`INSERT INTO sandbox_payments (change_order_id, project_id, at) VALUES (${`co-${i}`}, ${`copy-${i}`}, ${new Date(T0.getTime() - 60_000).toISOString()})`);
    }
    const pp = fakePayPal({ views: [invoiceView("SENT")] });

    const result = await simulateOwnedPayment(deps(pp.paypal), mine, orderId);

    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(pp.records).toEqual([]);
    expect(await placesTaken()).toBe(100);
  });
});
