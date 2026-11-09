import { CHANGE_ORDER_STATUSES, type ChangeOrderStatus } from "@/domain/types";

// What the screen looked like the last time this tab drew it, kept in sessionStorage per project. Payments arrive
// through a server refresh, so comparing with it is how the browser knows a ticket just turned paid.
export interface SeenSnapshot {
  orders: Readonly<Record<string, ChangeOrderStatus>>; // change order id → status
  activity: number; // highest activity event id shown
  launch: string; // the launch date shown (YYYY-MM-DD)
}

export interface MotionEvents {
  lift: readonly string[]; // orders whose barrier opens: paid (from draft or sent) or included at no charge
  paid: boolean; // one of them was paid, so the total settles green
  print: readonly string[]; // new draft tickets
  activityAfter: number | null; // entries with a higher id slide in; null when none are new
  launchMoved: boolean;
}

const NONE: MotionEvents = { lift: [], paid: false, print: [], activityAfter: null, launchMoved: false };

const opens = (before: ChangeOrderStatus | undefined, now: ChangeOrderStatus) =>
  (before === "draft" || before === "sent") && (now === "paid" || now === "waived");

// Nothing plays on a tab's first look (no snapshot): the page was just drawn by the server, as is.
export function motionEvents(before: SeenSnapshot | null, now: SeenSnapshot): MotionEvents {
  if (before === null) return NONE;
  const lift: string[] = [];
  const print: string[] = [];
  let paid = false;
  for (const [id, status] of Object.entries(now.orders)) {
    const was = before.orders[id];
    if (opens(was, status)) {
      lift.push(id);
      if (status === "paid") paid = true;
    }
    if (was === undefined && status === "draft") print.push(id);
  }
  return {
    lift,
    paid,
    print,
    activityAfter: now.activity > before.activity ? before.activity : null,
    launchMoved: now.launch !== before.launch,
  };
}

const isStatus = (value: unknown): value is ChangeOrderStatus => CHANGE_ORDER_STATUSES.some((s) => s === value);

// Reads a stored snapshot; anything malformed counts as none, so a bad value only skips one animation.
export function parseSnapshot(raw: string | null): SeenSnapshot | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { orders, activity, launch } = value as Record<string, unknown>;
    if (typeof orders !== "object" || orders === null || typeof activity !== "number" || typeof launch !== "string") return null;
    const clean: Record<string, ChangeOrderStatus> = {};
    for (const [id, status] of Object.entries(orders)) {
      if (isStatus(status)) clean[id] = status;
    }
    return { orders: clean, activity, launch };
  } catch {
    return null;
  }
}
