// What a server action tells the browser. Never a database row: only whether it worked and why not.
// server_error means the database failed (busy or unreachable) and nothing changed, so trying again may work.
export const ACTION_ERRORS = ["invalid_input", "not_found", "invalid_state", "server_error"] as const;
export type ActionError = (typeof ACTION_ERRORS)[number];
export type ActionResult = { ok: true } | { ok: false; error: ActionError };

// Reset's own extra answer. invoice_open: a change order has a PayPal invoice the client may still pay (sent, or a
// send that stopped part way or is under way), so the copy was left as it is; cancel it first.
export type ResetError = ActionError | "invoice_open";
export type ResetActionResult = { ok: true } | { ok: false; error: ResetError };

// Extra answers from the PayPal actions (send, cancel) and from waiving, which has to respect them. Kept apart so
// the reset messages stay as they are.
// in_progress: another request is sending this order · paypal_unavailable: PayPal didn't answer, trying again is safe
// paypal_rejected: PayPal refused, nothing was sent or cancelled · already_paid: the client paid, so it can't be cancelled
// not_configured: this server has no PayPal keys
// invoice_exists: PayPal already has an invoice for this draft, so it can't be waived; sending again settles it
// paypal_unconfirmed: PayPal took the request (it may have sent or cancelled the invoice) but that couldn't be
// confirmed or saved here; pressing again checks and settles it
// invoice_void: PayPal can't use this order's invoice any more (cancelled there), so the order is now cancelled
// and can be quoted again · rate_limited: the server-wide send cap is reached, so PayPal wasn't called
// copy_rate_limited: this copy's own send cap is reached (resetting it doesn't lift it), so PayPal wasn't called
// not_paid_yet: PayPal doesn't show the invoice as paid in full · invoice_changed: PayPal's invoice has a different
// reference, amount or currency than the order, so it wasn't marked paid
// sandbox_only: this server isn't on the PayPal sandbox, so no payment is simulated · not_payable: PayPal doesn't show the
// invoice as waiting for payment (part paid, pending or cancelled there), so no payment was recorded
export const PAYPAL_ACTION_ERRORS = [
  "in_progress",
  "paypal_unavailable",
  "paypal_rejected",
  "already_paid",
  "not_configured",
  "invoice_exists",
  "paypal_unconfirmed",
  "invoice_void",
  "rate_limited",
  "copy_rate_limited",
  "not_paid_yet",
  "invoice_changed",
  "sandbox_only",
  "not_payable",
] as const;
export type PayPalActionError = (typeof PAYPAL_ACTION_ERRORS)[number];
export type BillingActionResult = { ok: true } | { ok: false; error: ActionError | PayPalActionError };

// Answers from reviewing a message. marked: how many requests Claude marked as outside the scope (0 is a good answer).
// too_long: over MAX_REVIEW_MESSAGE_CHARS · not_configured: this server has no Claude key · rate_limited: the copy's or
// the server's cap is reached, so Claude wasn't called · claude_unavailable: Claude didn't answer or its answer couldn't
// be used · claude_refused: Claude declined the message. In every failure nothing was stored, so the text can be sent again.
export const REVIEW_ACTION_ERRORS = ["too_long", "not_configured", "rate_limited", "claude_unavailable", "claude_refused"] as const;
export type ReviewActionError = (typeof REVIEW_ACTION_ERRORS)[number];
export type ReviewActionResult = { ok: true; marked: number } | { ok: false; error: ActionError | ReviewActionError };
