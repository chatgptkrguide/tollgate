import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import type { BillingActionResult } from "@/domain/action-result";
import { paymentUnlock } from "@/domain/delivery";
import { invoiceNumberFor } from "@/domain/invoice";
import { formatUsd } from "@/domain/money";
import { paymentDecision, paymentPrecheck, type PaymentDecision } from "@/domain/payment";
import { actionErrorFor, errorDetail, failureSummary, recordFailure } from "./billing-errors";
import { activityInsertAfterChange } from "./db/activity";
import { markPaid, markPaidFromDraft, ownedStatus, readLaunchInputs, readPayableOrder, type PayableOrder } from "./db/change-orders";
import type { Db } from "./db/client";
import { PayPalError } from "./paypal/errors";
import type { InvoiceView } from "./paypal/invoices";

// Settling a paid invoice: the payment webhook, "Check payment" and a send PayPal refused because the invoice is
// already paid all end here, with the rule in domain/payment.ts. The status change is one conditional UPDATE, so
// when two of them arrive together only one moves the order, and only that one leaves activity steps behind.

export type PaymentSource = "webhook" | "check" | "send";

// What "Check payment" needs. billing.ts's BillingDeps fits it; this file doesn't import billing.ts, which imports
// settleStatements from here (P3-D2).
export interface PaymentDeps {
  db: Db;
  paypal: { get(invoiceId: string): Promise<InvoiceView> } | null; // null: no PayPal keys on this server
  now: () => Date;
}

// The statements that settle an order, for a db.batch(): the UPDATE, then its activity steps, each written only if
// the statement before it changed a row (activityInsertAfterChange). From a draft: invoice_sent (recovered: true)
// then payment_confirmed; then work_unlocked, which says the payment unlocked the order's work and where the launch
// now lands (domain/delivery.ts). Empty for any decision but "settle".
// The launch is read just before the batch, so if two orders of one copy settle at the same instant, one line may
// leave out the other's days; the Delivery panel reads the orders afresh and is always right.
export async function settleStatements(
  db: Db,
  order: PayableOrder,
  invoice: InvoiceView,
  decision: PaymentDecision,
  at: string,
  source: PaymentSource,
  eventId?: string,
): Promise<BatchItem<"sqlite">[]> {
  if (decision.kind !== "settle") return [];
  const invoiceId = invoice.id;
  const invoiceNumber = invoice.invoiceNumber ?? invoiceNumberFor(order.id);
  const confirmed = activityInsertAfterChange(db, {
    projectId: order.projectId,
    changeOrderId: order.id,
    kind: "payment_confirmed",
    actor: "paypal",
    summary: `PayPal shows invoice ${invoiceNumber} as paid in full (${formatUsd(order.amountCents)})`,
    detail: { invoiceId, paypalStatus: invoice.status, amount: invoice.amountValue, source, eventId: eventId ?? null },
    at,
  });
  const steps = [confirmed, ...(await unlockedStep(db, order, at))];
  if (decision.from === "sent") return [markPaid(db, order, invoiceId, at), ...steps];
  return [
    markPaidFromDraft(db, order, invoiceId, at, invoice.payerViewUrl),
    activityInsertAfterChange(db, {
      projectId: order.projectId,
      changeOrderId: order.id,
      kind: "invoice_sent",
      actor: "paypal",
      summary: `Invoice ${invoiceNumber} had gone out to the client; recorded as sent when PayPal showed it paid`,
      detail: { invoiceId, paypalStatus: invoice.status, payerViewUrl: invoice.payerViewUrl, recovered: true },
      at,
    }),
    ...steps,
  ];
}

// Placed right after payment_confirmed, so it lands only if that step did (changes() then counts that insert): a
// payment that didn't move the order unlocks nothing. None if the project or the order is gone.
async function unlockedStep(db: Db, order: PayableOrder, at: string): Promise<BatchItem<"sqlite">[]> {
  const inputs = await readLaunchInputs(db, order.projectId);
  const unlock = inputs && paymentUnlock(inputs.agreedLaunch, inputs.orders, order.id, at);
  if (!inputs || !unlock) return [];
  return [
    activityInsertAfterChange(db, {
      projectId: order.projectId,
      changeOrderId: order.id,
      kind: "work_unlocked",
      actor: "app",
      summary: unlock.summary,
      detail: { agreedLaunch: inputs.agreedLaunch, launch: unlock.plan.launch, days: unlock.row.days },
      at,
    }),
  ];
}

type BillingError = Extract<BillingActionResult, { ok: false }>["error"];
const OK: BillingActionResult = { ok: true };
const fail = (error: BillingError): BillingActionResult => ({ ok: false, error });

// "Check payment": owner check → precheck → read the invoice → decide → batch. Never takes amounts from the form.
// ok: the order is paid (now or before) · not_paid_yet · invoice_changed (mismatch) · invalid_state (waived, cancelled,
// draft without invoice) · not_found · not_configured · paypal_unavailable / paypal_rejected (read failed, recorded
// as a paypal_failed step "read").
export async function checkOwnedPayment(deps: PaymentDeps, ownerProjectId: string, changeOrderId: string): Promise<BillingActionResult> {
  const { db, paypal, now } = deps;
  if (!paypal) return fail("not_configured");

  const order = await readPayableOrder(db, ownerProjectId, changeOrderId);
  if (!order) return fail("not_found");
  const precheck = paymentPrecheck(order);
  if (precheck === "already_paid") return OK;
  if (precheck !== "read" || !order.paypalInvoiceId) return fail("invalid_state");

  let invoice: InvoiceView;
  try {
    invoice = await paypal.get(order.paypalInvoiceId);
  } catch (error) {
    if (!(error instanceof PayPalError)) throw error;
    console.error("PayPal read failed while checking a payment", error);
    await recordFailure(deps, { ownerProjectId, changeOrderId, step: "read", summary: failureSummary(error, "read"), detail: errorDetail(error) });
    return fail(actionErrorFor(error));
  }

  const decision = paymentDecision(order, invoice);
  if (decision.kind === "mismatch") {
    console.error(`invoice ${invoice.id} doesn't match its change order's reference, amount or currency; not marked paid`);
    return fail("invoice_changed");
  }
  const [first, ...rest] = await settleStatements(db, order, invoice, decision, now().toISOString(), "check");
  if (!first) return fail("not_paid_yet");
  await db.batch([first, ...rest]);
  // Paid by this batch or by a webhook that got there first; anything else moved the order meanwhile (a cancel).
  const status = await ownedStatus(db, ownerProjectId, changeOrderId);
  if (status === "paid") return OK;
  return fail(status === null ? "not_found" : "invalid_state");
}
