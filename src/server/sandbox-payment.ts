import "server-only";
import type { BillingActionResult } from "@/domain/action-result";
import { invoiceNumberFor } from "@/domain/invoice";
import { toPayPalValue } from "@/domain/money";
import { paymentDecision, paymentPrecheck } from "@/domain/payment";
import { actionErrorFor, errorDetail, failureSummary, recordFailure } from "./billing-errors";
import { activityInsert } from "./db/activity";
import { readPayableOrder } from "./db/change-orders";
import { getDb, type Db } from "./db/client";
import { takeSandboxPayment } from "./db/sandbox-payments";
import { PayPalError } from "./paypal/errors";
import { getInvoice, recordPayment, type InvoiceView, type RecordedPayment } from "./paypal/invoices";
import { getPayPal, type PayPalEnvironment } from "./paypal/token";

// "Simulate the client's payment (sandbox)": a judge without a sandbox buyer login can still see the order get paid.
// The server records the whole amount on the copy's sent invoice through PayPal's API, the same call the demo video
// uses, and PayPal then shows it MARKED_AS_PAID and sends its signed INVOICING.INVOICE.PAID webhook. Nothing is marked
// paid here: the webhook (or "Check payment") settles the order through payments.ts exactly as for a real payment, so
// the shortcut proves the same path end to end and can't skip a check.

export interface SandboxPayPal {
  readonly environment: PayPalEnvironment;
  get(invoiceId: string): Promise<InvoiceView>;
  recordPayment(invoiceId: string, payment: RecordedPayment): Promise<"recorded" | "not_payable">;
}

export interface SandboxPaymentDeps {
  db: Db;
  paypal: SandboxPayPal | null; // null: no PayPal keys on this server
  now: () => Date;
}

export function liveSandboxPaymentDeps(): SandboxPaymentDeps {
  const client = getPayPal();
  return {
    db: getDb(),
    paypal: client && {
      environment: client.environment,
      get: (invoiceId) => getInvoice(client, invoiceId),
      recordPayment: (invoiceId, payment) => recordPayment(client, invoiceId, payment),
    },
    now: () => new Date(),
  };
}

// Invoice statuses a payment can be recorded on: out to the client and nothing paid yet. A part-paid or pending one
// already has the client's money on it, and the shortcut doesn't add to it.
const RECORDABLE: ReadonlySet<string> = new Set(["SENT", "UNPAID", "SHARED"]);

export const SANDBOX_PAYMENT_NOTE = "Sandbox demo: recorded by Tollgate as the client's payment";

type BillingError = Extract<BillingActionResult, { ok: false }>["error"];
const OK: BillingActionResult = { ok: true };
const fail = (error: BillingError): BillingActionResult => ({ ok: false, error });

// Owner check → sandbox only → read the invoice → nothing to record if PayPal already shows it paid (already_paid:
// "Check payment" brings the page up to date) → caps → record the payment → one activity step. Never takes an amount
// from the form: the order's amount must match the invoice's (else invoice_changed), and that whole amount is recorded.
// ok: PayPal recorded it; the order stays sent until the webhook or "Check payment" reads it back.
export async function simulateOwnedPayment(deps: SandboxPaymentDeps, ownerProjectId: string, changeOrderId: string): Promise<BillingActionResult> {
  const { db, paypal, now } = deps;
  if (!paypal) return fail("not_configured");
  if (paypal.environment !== "sandbox") return fail("sandbox_only");

  const order = await readPayableOrder(db, ownerProjectId, changeOrderId);
  if (!order) return fail("not_found");
  const precheck = paymentPrecheck(order);
  if (precheck === "already_paid") return fail("already_paid");
  if (order.status !== "sent" || !order.paypalInvoiceId) return fail("invalid_state");
  const invoiceId = order.paypalInvoiceId;

  const failed = async (error: unknown, step: "read" | "record"): Promise<BillingActionResult> => {
    if (!(error instanceof PayPalError)) throw error;
    console.error(`PayPal ${step} failed while simulating a sandbox payment`, error);
    await recordFailure(deps, { ownerProjectId, changeOrderId, step, summary: failureSummary(error, step), detail: errorDetail(error) });
    return fail(actionErrorFor(error));
  };

  let invoice: InvoiceView;
  try {
    invoice = await paypal.get(invoiceId);
  } catch (error) {
    return failed(error, "read");
  }
  const decision = paymentDecision(order, invoice);
  if (decision.kind === "mismatch") {
    console.error(`invoice ${invoice.id} doesn't match its change order's reference, amount or currency; no payment recorded`);
    return fail("invoice_changed");
  }
  if (decision.kind === "settle") return fail("already_paid");
  if (!RECORDABLE.has(invoice.status)) return fail("not_payable");

  const at = now();
  const take = await takeSandboxPayment(db, ownerProjectId, changeOrderId, at);
  if (take !== "taken") {
    console.warn(take === "copy_full" ? "a demo copy reached its sandbox payment limit; not calling PayPal" : "the server-wide sandbox payment limit is reached; not calling PayPal");
    return fail(take === "copy_full" ? "copy_rate_limited" : "rate_limited");
  }

  const amountValue = toPayPalValue(order.amountCents);
  let recorded: "recorded" | "not_payable";
  try {
    recorded = await paypal.recordPayment(invoiceId, { amountValue, date: at.toISOString().slice(0, 10), note: SANDBOX_PAYMENT_NOTE });
  } catch (error) {
    return failed(error, "record");
  }
  if (recorded === "not_payable") {
    // Another press (or the client) got there first: say which, without recording anything.
    const after = await paypal.get(invoiceId).catch(() => null);
    return fail(after && paymentDecision(order, after).kind === "settle" ? "already_paid" : "not_payable");
  }

  const invoiceNumber = invoice.invoiceNumber ?? invoiceNumberFor(order.id);
  try {
    await activityInsert(db, {
      projectId: ownerProjectId,
      changeOrderId,
      kind: "payment_recorded",
      actor: "paypal",
      summary: `Recorded a sandbox payment on invoice ${invoiceNumber} through PayPal's API, as if the client paid. Waiting for PayPal's webhook.`,
      detail: { invoiceId, amount: amountValue, currency: "USD", method: "PAYPAL", sandbox: true },
      at: now().toISOString(),
    });
  } catch (error) {
    // PayPal did record it; only the activity line is missing. The webhook or "Check payment" still settles the order.
    console.error("recording a sandbox payment step failed", error);
  }
  return OK;
}
