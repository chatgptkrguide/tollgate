import { formatShortDate } from "@/domain/dates";
import { invoiceNumberFor } from "@/domain/invoice";
import type { ChangeOrder, ChangeOrderStatus } from "@/domain/types";

// One wording and one signal colour per status, shared by the tickets, the Scope list and the header.

export const statusText: Record<ChangeOrderStatus, string> = {
  draft: "Not sent yet",
  sent: "Sent to client, not paid yet",
  paid: "Paid",
  waived: "Included at no charge",
  cancelled: "Cancelled",
};

// STOP while money is still owed, GO once it's received, grey for work that is free or off.
export type Tone = "stop" | "go" | "idle";

export const statusTone: Record<ChangeOrderStatus, Tone> = {
  draft: "stop",
  sent: "stop",
  paid: "go",
  waived: "idle",
  cancelled: "idle",
};

export function statusLine(order: Pick<ChangeOrder, "status" | "paidAt">): string {
  return order.status === "paid" && order.paidAt ? `${statusText.paid} ${formatShortDate(order.paidAt)}` : statusText[order.status];
}

export const noteId = (order: Pick<ChangeOrder, "id">) => `note-${order.id}`;
export const statusLineId = (order: Pick<ChangeOrder, "id">) => `status-${order.id}`;
export const titleId = (order: Pick<ChangeOrder, "id">) => `title-${order.id}`;
export const quoteId = (findingId: string) => `quote-${findingId}`;

// The PayPal invoice number the ticket will carry (TG- + 22 characters); a seed id that isn't a UUID shows none.
export function ticketNumber(orderId: string): string | null {
  try {
    return invoiceNumberFor(orderId);
  } catch {
    return null;
  }
}

// "≈ 8.7 h · +3 days"
export function effortLine(hours: number, days: number): string {
  const h = Number(hours.toFixed(1));
  return `≈ ${h} h · +${days} ${days === 1 ? "day" : "days"}`;
}
