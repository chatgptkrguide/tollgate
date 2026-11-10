// One step the app, PayPal or Claude took, as the activity panel shows it.
// P2 writes the PayPal steps; P3 adds payment_confirmed; P4 adds the review steps; P6 adds work_unlocked;
// payment_recorded is the sandbox shortcut that records the client's payment through PayPal's API.
// The database has no CHECK on these lists (a new kind would need a table rebuild), so this file is the guard.
export const ACTIVITY_KINDS = [
  "message_read",
  "findings_proposed",
  "price_computed",
  "review_failed",
  "invoice_created",
  "invoice_sent",
  "invoice_cancelled",
  "paypal_failed",
  "payment_confirmed",
  "work_unlocked",
  "payment_recorded",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_ACTORS = ["app", "paypal", "claude"] as const;
export type ActivityActor = (typeof ACTIVITY_ACTORS)[number];

// Plain values only, so there is no place to put a token or a secret by accident.
export type ActivityDetail = Readonly<Record<string, string | number | boolean | null>>;

export interface ActivityEvent {
  id: number; // insertion order; the panel lists events in this order
  projectId: string;
  changeOrderId: string | null; // null for steps about a message (P4)
  kind: ActivityKind;
  actor: ActivityActor;
  summary: string; // one English line, shown as is
  detail: ActivityDetail | null;
  at: string; // ISO, UTC
}

export type NewActivityEvent = Omit<ActivityEvent, "id">;
