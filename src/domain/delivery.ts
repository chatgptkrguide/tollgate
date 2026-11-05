import { formatShortDate } from "./dates";
import type { ChangeOrder } from "./types";

// Extra work stays locked until its change order is paid; paying unlocks it and moves the launch by its days.
// One rule for the Delivery panel and the activity step the payment writes, so the two can never disagree. No I/O.

// locked: draft or sent, not started until paid · unlocked: paid · included: waived, done at no charge.
// Cancelled orders have no row: that work isn't happening.
export type DeliveryState = "locked" | "unlocked" | "included";

export type DeliveryOrder = Pick<ChangeOrder, "id" | "title" | "status" | "extraDays" | "paidAt">;

export interface DeliveryRow {
  orderId: string;
  title: string;
  days: number; // whole days this work adds to the launch once unlocked
  state: DeliveryState;
  unlockedAt: string | null; // the paid date for unlocked rows, else null
}

export interface DeliveryPlan {
  agreedLaunch: string; // YYYY-MM-DD, as agreed with the client
  launch: string; // agreedLaunch + the days of every unlocked or included row
  moved: boolean; // launch !== agreedLaunch
  rows: readonly DeliveryRow[]; // in the order given, cancelled left out
  lockedDays: number; // days the locked rows would add once paid
}

// Days are counted whole: a fraction rounds up (half a day still takes the day), anything not above zero adds none.
function wholeDays(days: number): number {
  return days > 0 && Number.isFinite(days) ? Math.ceil(days) : 0;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

// "2026-11-15" + 3 → "2026-11-18", in UTC so month ends and daylight saving never shift it. Anything that isn't a
// YYYY-MM-DD date is returned as written, like formatShortDate does.
export function addDays(date: string, days: number): string {
  const match = DATE_ONLY.exec(date);
  if (!match) return date;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + wholeDays(days)));
  return at.toISOString().slice(0, 10);
}

function stateOf(order: DeliveryOrder): DeliveryState | null {
  switch (order.status) {
    case "draft":
    case "sent":
      return "locked";
    case "paid":
      return "unlocked";
    case "waived":
      return "included";
    default:
      return null;
  }
}

export function deliveryPlan(agreedLaunch: string, orders: readonly DeliveryOrder[]): DeliveryPlan {
  const rows: DeliveryRow[] = [];
  for (const order of orders) {
    const state = stateOf(order);
    if (state === null) continue;
    rows.push({
      orderId: order.id,
      title: order.title,
      days: wholeDays(order.extraDays),
      state,
      unlockedAt: state === "unlocked" ? order.paidAt : null,
    });
  }
  const sumDays = (picked: readonly DeliveryRow[]) => picked.reduce((sum, row) => sum + row.days, 0);
  const launch = addDays(agreedLaunch, sumDays(rows.filter((row) => row.state !== "locked")));
  return {
    agreedLaunch,
    launch,
    moved: launch !== agreedLaunch,
    rows,
    lockedDays: sumDays(rows.filter((row) => row.state === "locked")),
  };
}

export interface PaymentUnlock {
  plan: DeliveryPlan; // the plan once this order is paid
  row: DeliveryRow; // this order's row, unlocked
  summary: string; // the activity line: "Payment unlocked “Gift card page”; launch moves to Nov 16."
}

// What paying this order changes, for the activity step the payment writes. Null when the order isn't in the list
// (deleted meanwhile) or would have no row (cancelled).
export function paymentUnlock(agreedLaunch: string, orders: readonly DeliveryOrder[], paidOrderId: string, paidAt: string): PaymentUnlock | null {
  const paid = orders.find((o) => o.id === paidOrderId);
  if (!paid || stateOf(paid) === null) return null;
  const plan = deliveryPlan(
    agreedLaunch,
    orders.map((o) => (o.id === paidOrderId ? { ...o, status: "paid" as const, paidAt } : o)),
  );
  const row = plan.rows.find((r) => r.orderId === paidOrderId);
  if (!row) return null;
  const when = formatShortDate(plan.launch);
  const launch = row.days > 0 ? `launch moves to ${when}` : `launch stays ${when}`;
  return { plan, row, summary: `Payment unlocked “${row.title}”; ${launch}.` };
}
