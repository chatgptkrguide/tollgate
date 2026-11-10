"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, type MouseEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { cancelChangeOrder, checkPayment, requoteChangeOrder, sendChangeOrder, simulateClientPayment, waiveChangeOrder } from "@/app/actions";
import { awaitPaymentPoller } from "@/components/await-payment";
import type { ActionError, ActionResult, BillingActionResult, PayPalActionError } from "@/domain/action-result";
import { SANDBOX_PAYMENT_LIMITS_PER_COPY } from "@/domain/sandbox-payment-limit";
import { SEND_LIMITS_PER_COPY } from "@/domain/send-limit";
import type { ChangeOrder } from "@/domain/types";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";

export interface ActionsOrder extends Pick<ChangeOrder, "id" | "status" | "payerViewUrl"> {
  hasInvoice: boolean; // PayPal already has an invoice for it (never the id itself: that stays on the server)
}

export interface ChangeOrderActionsProps {
  order: ActionsOrder;
  sendBlockedReason: string | null; // why PayPal actions are off (no keys on this server); null when they work
  // The read-only preview (no copy exists): including for free and quoting again are off too, with the same reason.
  readOnly: boolean;
  sandbox: boolean; // the server talks to the PayPal sandbox, so the simulated-payment shortcut is offered

  statusLineId: string; // the note's status line (role="status", tabIndex -1), focused after an action succeeds
  locale: Locale;
}

const COPY_SEND_MAX = SEND_LIMITS_PER_COPY[0].max;
const COPY_SANDBOX_PAYMENT_MAX = SANDBOX_PAYMENT_LIMITS_PER_COPY[0].max;

// Error codes the cancel, check and simulate buttons explain in their own words; every other code reads as
// changeOrderErrors.
const CANCEL_ERRORS = ["paypal_unavailable", "paypal_rejected", "paypal_unconfirmed", "not_configured"] as const;
const CHECK_ERRORS = ["paypal_unavailable", "paypal_rejected", "not_configured"] as const;
const SIMULATE_ERRORS = ["paypal_unavailable", "paypal_rejected", "not_configured", "already_paid", "rate_limited", "invoice_changed"] as const;
type ErrorGroup = "changeOrderErrors" | "cancelErrors" | "checkErrors" | "simulateErrors";

function errorMessage(locale: Locale, group: ErrorGroup, code: ActionError | PayPalActionError): string {
  const max = { max: COPY_SEND_MAX };
  if (group === "simulateErrors") {
    if (code === "copy_rate_limited") return t(locale, "simulateErrors.copy_rate_limited", { max: COPY_SANDBOX_PAYMENT_MAX });
    const own = SIMULATE_ERRORS.find((c) => c === code);
    if (own) return t(locale, `simulateErrors.${own}`);
  }
  if (group === "cancelErrors") {
    const own = CANCEL_ERRORS.find((c) => c === code);
    if (own) return t(locale, `cancelErrors.${own}`);
  }
  if (group === "checkErrors") {
    const own = CHECK_ERRORS.find((c) => c === code);
    if (own) return t(locale, `checkErrors.${own}`);
  }
  return t(locale, `changeOrderErrors.${code}`, max);
}

// Classes in globals.css: a 1px press, hover shades, and palette colours when aria-disabled (no colour change then).
const PRIMARY = "btn btn-primary";
const SECONDARY = "btn btn-secondary";

// A thin running bar along the bottom of a busy button; the label says the same in words.
function Busy() {
  return <span aria-hidden="true" className="btn-progress" />;
}

// A spinning ring before the label of a button whose PayPal call takes a few seconds.
function Spinner() {
  return <span aria-hidden="true" className="btn-spinner" />;
}

// The pressed button is about to disappear (the note changes state), so focus goes to the status line,
// and the screen reader reads the new status.
function useFocusOnSuccess(state: ActionResult | BillingActionResult | null, statusLineId: string) {
  useEffect(() => {
    if (state?.ok) document.getElementById(statusLineId)?.focus();
  }, [state, statusLineId]);
}

// The buttons under a change order: send or include at no charge (draft), send again (a draft PayPal already has an
// invoice for), the client's PayPal page, check payment and cancel (sent), quote again (cancelled). The browser sends
// only the order id; the server decides the rest.
export function ChangeOrderActions({ order, sendBlockedReason, readOnly, sandbox, statusLineId, locale }: ChangeOrderActionsProps) {
  // Every hook stays here, whatever the status, so the component stays mounted through the refresh after an
  // action and can move focus once the new status arrives.
  const [waiveState, waiveAction, waiving] = useActionState(waiveChangeOrder, null);
  const [sendState, sendAction, sending] = useActionState(sendChangeOrder, null);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelChangeOrder, null);
  const [requoteState, requoteAction, requoting] = useActionState(requoteChangeOrder, null);
  const [checkState, checkAction, checking] = useActionState(checkPayment, null);
  const [simulateState, simulateAction, simulating] = useActionState(simulateClientPayment, null);
  const router = useRouter();
  // Which confirmation is open, for which order: quoting again gives this note a new order.
  const [confirming, setConfirming] = useState<{ step: "waive" | "cancel"; orderId: string } | null>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const includeRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepInvoiceRef = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const confirmId = useId();
  const cancelConfirmId = useId();
  const resendId = useId();
  const simulateHelpId = useId();

  useFocusOnSuccess(waiveState, statusLineId);
  useFocusOnSuccess(sendState, statusLineId);
  useFocusOnSuccess(cancelState, statusLineId);
  useFocusOnSuccess(requoteState, statusLineId);
  useFocusOnSuccess(checkState, statusLineId);
  // Sending found the invoice cancelled in PayPal: the note turned cancelled, so focus goes to its status line too.
  useEffect(() => {
    if (sendState?.ok === false && sendState.error === "invoice_void") document.getElementById(statusLineId)?.focus();
  }, [sendState, statusLineId]);
  // Waiving was refused because PayPal has the invoice: the waive buttons are gone, so focus goes to "Send again".
  useEffect(() => {
    if (waiveState?.ok === false && waiveState.error === "invoice_exists") sendRef.current?.focus();
  }, [waiveState]);
  // A sandbox payment was recorded and the ticket isn't paid yet: re-read the page until PayPal's webhook lands (at most
  // 90 s, and not while the page is hidden). The ticket turning paid ends it.
  const awaitingWebhook = simulateState?.ok === true && order.status === "sent";
  useEffect(() => {
    if (!awaitingWebhook) return;
    return awaitPaymentPoller(
      () => router.refresh(),
      () => document.visibilityState === "hidden",
    );
  }, [awaitingWebhook, router]);

  const blocked = sendBlockedReason !== null;
  const isConfirming = (step: "waive" | "cancel") => confirming?.step === step && confirming.orderId === order.id;

  // Opening or closing a confirmation replaces the pressed button, so focus moves to the one in its place.
  // The "keep" button takes the first spot, so a double click lands on it rather than on the confirmation.
  const openConfirm = (step: "waive" | "cancel", target: RefObject<HTMLButtonElement | null>) => {
    flushSync(() => setConfirming({ step, orderId: order.id }));
    target.current?.focus();
  };
  const closeConfirm = (target: RefObject<HTMLButtonElement | null>) => {
    flushSync(() => setConfirming(null));
    target.current?.focus();
  };
  // No second submit while the first is running. Nothing else happens on the click: a re-render here would
  // rewrite the hidden id before the form is read.
  const submitOnce = (busy: boolean) => (event: MouseEvent<HTMLButtonElement>) => {
    if (busy) event.preventDefault();
  };

  const reason = blocked && (
    <p id={reasonId} className="mt-3 text-[14px] leading-relaxed text-ink-2">
      {sendBlockedReason}
    </p>
  );
  // Each action keeps its last answer until it runs again; a success changes the status, which hides the panel.
  // "Not paid yet" is an answer, not a failure: it reads as a calm status line, not an alert.
  const errorFor = (state: ActionResult | BillingActionResult | null, group: ErrorGroup = "changeOrderErrors") =>
    state &&
    !state.ok &&
    (state.error === "not_paid_yet" ? (
      <p role="status" className="mt-3 text-[14px] leading-relaxed text-ink-2">
        {t(locale, "changeOrderErrors.not_paid_yet")}
      </p>
    ) : (
      <p role="alert" className="mt-3 border-l-2 border-stop pl-3 text-[14px] leading-relaxed font-semibold text-ink">
        {errorMessage(locale, group, state.error)}
      </p>
    ));

  if (order.status === "draft") {
    // An earlier send got as far as creating the PayPal invoice, and the client may already have it (P2-D1).
    // Sending again finishes the job (PayPal never sends one invoice twice); waiving would leave it payable.
    const resend = order.hasInvoice;
    const confirmingWaive = !resend && isConfirming("waive");
    const sendDescribedBy = [resend && resendId, blocked && reasonId].filter(Boolean).join(" ") || undefined;
    return (
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          <form action={sendAction} data-action="send">
            <input type="hidden" name="changeOrderId" value={order.id} />
            {/* aria-disabled, not disabled: keyboard and screen reader users can still reach it and hear why. */}
            <button
              ref={sendRef}
              type="submit"
              aria-disabled={blocked || sending || undefined}
              aria-busy={sending || undefined}
              aria-describedby={sendDescribedBy}
              onClick={submitOnce(blocked || sending)}
              data-busy={sending || undefined}
              className={`${PRIMARY} ${blocked ? "aria-disabled:cursor-not-allowed" : "aria-disabled:cursor-wait"}`}
            >
              {sending && <Spinner />}
              {sending ? t(locale, "changeOrder.sending") : resend ? t(locale, "changeOrder.sendAgain") : t(locale, "changeOrder.send")}
              {sending && <Busy />}
            </button>
          </form>
          {/* Creating and sending takes a few seconds (two or three PayPal calls); screen readers hear it once. */}
          <p aria-live="polite" className="sr-only">
            {sending ? t(locale, "changeOrder.sending") : ""}
          </p>
          {!resend && (
            <form action={waiveAction} data-action="waive" className="flex flex-wrap gap-2">
              <input type="hidden" name="changeOrderId" value={order.id} />
              {confirmingWaive ? (
                <>
                  <button
                    key="keep"
                    ref={keepRef}
                    type="button"
                    onClick={waiving ? undefined : () => closeConfirm(includeRef)}
                    aria-disabled={waiving || undefined}
                    aria-describedby={confirmId}
                    className={SECONDARY}
                  >
                    {t(locale, "changeOrder.keepCharge")}
                  </button>
                  {/* aria-disabled while saving, not disabled: a disabled button drops the focus it holds. */}
                  <button
                    key="confirm"
                    type="submit"
                    aria-disabled={waiving || undefined}
                    aria-describedby={confirmId}
                    onClick={submitOnce(waiving)}
                    className={`${PRIMARY} aria-disabled:cursor-wait`}
                  >
                    {t(locale, "changeOrder.confirmWaive")}
                  </button>
                </>
              ) : (
                <button
                  key="include"
                  ref={includeRef}
                  type="button"
                  aria-disabled={readOnly || undefined}
                  aria-describedby={readOnly && blocked ? reasonId : undefined}
                  onClick={readOnly ? undefined : () => openConfirm("waive", keepRef)}
                  className={`${SECONDARY} aria-disabled:cursor-not-allowed`}
                >
                  {t(locale, "changeOrder.includeFree")}
                </button>
              )}
            </form>
          )}
        </div>
        {resend && (
          <p id={resendId} className="mt-3 text-[14px] leading-relaxed">
            {t(locale, "changeOrder.resendHelp")}
          </p>
        )}
        {confirmingWaive && (
          <p id={confirmId} className="mt-3 text-[14px] leading-relaxed">
            {t(locale, "changeOrder.waiveConfirmHelp")}
          </p>
        )}
        {reason}
        {/* invoice_void belongs to the order that became cancelled, never to a draft quoted again after it. */}
        {sendState?.ok === false && sendState.error !== "invoice_void" && errorFor(sendState)}
        {errorFor(waiveState)}
      </div>
    );
  }

  if (order.status === "sent") {
    const confirmingCancel = isConfirming("cancel");
    return (
      <div className="mt-4">
        {order.payerViewUrl && (
          <a
            href={order.payerViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full sm:w-auto"
          >
            {t(locale, "changeOrder.openPayerPage")}
            <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" className="-mt-0.5">
              <path d="M4.5 2.5h5v5M9.5 2.5 3 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sr-only"> {t(locale, "changeOrder.opensNewTab")}</span>
          </a>
        )}
        {order.payerViewUrl && (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            {t(locale, "changeOrder.payAsClient")}
          </p>
        )}
        {/* When the webhook is late: reads the invoice from PayPal and marks it paid if PayPal says so. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={checkAction} data-action="check-payment">
            <input type="hidden" name="changeOrderId" value={order.id} />
            <button
              type="submit"
              aria-disabled={blocked || checking || undefined}
              aria-describedby={blocked ? reasonId : undefined}
              onClick={submitOnce(blocked || checking)}
              className={`${SECONDARY} ${blocked ? "aria-disabled:cursor-not-allowed" : "aria-disabled:cursor-wait"}`}
            >
              {checking ? t(locale, "changeOrder.checking") : t(locale, "changeOrder.checkPayment")}
              {checking && <Busy />}
            </button>
          </form>
          {/* Sandbox shortcut for a judge without a buyer login: PayPal records the payment, its webhook settles it. */}
          {sandbox && (
            <form action={simulateAction} data-action="simulate-payment">
              <input type="hidden" name="changeOrderId" value={order.id} />
              <button
                type="submit"
                aria-disabled={blocked || simulating || undefined}
                aria-busy={simulating || undefined}
                aria-describedby={[simulateHelpId, blocked && reasonId].filter(Boolean).join(" ")}
                onClick={submitOnce(blocked || simulating)}
                className={`${SECONDARY} ${blocked ? "aria-disabled:cursor-not-allowed" : "aria-disabled:cursor-wait"}`}
              >
                {simulating && <Spinner />}
                {simulating ? t(locale, "changeOrder.simulating") : t(locale, "changeOrder.simulatePayment")}
                <span aria-hidden="true" className="sandbox-tag">
                  {t(locale, "changeOrder.sandboxTag")}
                </span>
                <span className="sr-only"> ({t(locale, "changeOrder.sandboxTag")})</span>
                {simulating && <Busy />}
              </button>
            </form>
          )}
          <form action={cancelAction} data-action="cancel" className="flex flex-wrap gap-2">
            <input type="hidden" name="changeOrderId" value={order.id} />
            {confirmingCancel ? (
              <>
                <button
                  key="keep-invoice"
                  ref={keepInvoiceRef}
                  type="button"
                  onClick={cancelling ? undefined : () => closeConfirm(cancelRef)}
                  aria-disabled={cancelling || undefined}
                  aria-describedby={cancelConfirmId}
                  className={SECONDARY}
                >
                  {t(locale, "changeOrder.keepInvoice")}
                </button>
                <button
                  key="confirm-cancel"
                  type="submit"
                  aria-disabled={cancelling || undefined}
                  aria-describedby={cancelConfirmId}
                  onClick={submitOnce(cancelling)}
                  className={`${PRIMARY} aria-disabled:cursor-wait`}
                >
                  {cancelling ? t(locale, "changeOrder.cancelling") : t(locale, "changeOrder.confirmCancel")}
                  {cancelling && <Busy />}
                </button>
              </>
            ) : (
              <button
                key="cancel"
                ref={cancelRef}
                type="button"
                aria-disabled={blocked || undefined}
                aria-describedby={blocked ? reasonId : undefined}
                onClick={blocked ? undefined : () => openConfirm("cancel", keepInvoiceRef)}
                className={`${SECONDARY} aria-disabled:cursor-not-allowed`}
              >
                {t(locale, "changeOrder.cancelInvoice")}
              </button>
            )}
          </form>
        </div>
        {confirmingCancel && (
          <p id={cancelConfirmId} className="mt-3 text-[14px] leading-relaxed">
            {t(locale, "changeOrder.cancelConfirmHelp")}
          </p>
        )}
        {sandbox && (
          <p id={simulateHelpId} className="mt-3 text-[14px] leading-relaxed text-ink-2">
            {t(locale, "changeOrder.simulateHelp")}
          </p>
        )}
        {reason}
        {/* Recorded in PayPal, not paid here yet: a calm status line, while the page re-reads until the webhook lands. */}
        {simulateState?.ok && (
          <p role="status" data-testid="simulate-status" className="mt-3 border-l-2 border-line pl-3 text-[14px] leading-relaxed font-semibold text-ink">
            {t(locale, "changeOrder.simulateRecorded")}
          </p>
        )}
        {errorFor(simulateState, "simulateErrors")}
        {errorFor(checkState, "checkErrors")}
        {errorFor(cancelState, "cancelErrors")}
      </div>
    );
  }

  if (order.status === "cancelled") {
    return (
      <div className="mt-4">
        <form action={requoteAction} data-action="requote">
          <input type="hidden" name="changeOrderId" value={order.id} />
          <button
            type="submit"
            aria-disabled={readOnly || requoting || undefined}
            aria-describedby={readOnly && blocked ? reasonId : undefined}
            onClick={submitOnce(readOnly || requoting)}
            className={`${SECONDARY} ${readOnly ? "aria-disabled:cursor-not-allowed" : "aria-disabled:cursor-wait"}`}
          >
            {requoting ? t(locale, "changeOrder.quoting") : t(locale, "changeOrder.quoteAgain")}
            {requoting && <Busy />}
          </button>
        </form>
        {readOnly && reason}
        {sendState?.ok === false && sendState.error === "invoice_void" && errorFor(sendState)}
        {errorFor(requoteState)}
      </div>
    );
  }

  return null; // paid and waived are settled
}
