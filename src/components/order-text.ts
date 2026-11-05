import { invoiceNumberFor } from "@/domain/invoice";
import type { ChangeOrder, ChangeOrderStatus } from "@/domain/types";
import { formatDate, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { t, tCount, type MessageKey } from "@/i18n/t";

// One wording and one signal colour per status, shared by the tickets, the Scope list and the header.

const statusKey = {
  draft: "workspace.statusDraft",
  sent: "workspace.statusSent",
  paid: "workspace.statusPaid",
  waived: "workspace.statusWaived",
  cancelled: "workspace.statusCancelled",
} as const satisfies Record<ChangeOrderStatus, MessageKey>;

export function statusText(locale: Locale, status: ChangeOrderStatus): string {
  return t(locale, statusKey[status]);
}

// STOP while money is still owed, GO once it's received, grey for work that is free or off.
export type Tone = "stop" | "go" | "idle";

export const statusTone: Record<ChangeOrderStatus, Tone> = {
  draft: "stop",
  sent: "stop",
  paid: "go",
  waived: "idle",
  cancelled: "idle",
};

// "Paid Nov 5" once paid with a date, otherwise the status in words.
export function statusLine(locale: Locale, order: Pick<ChangeOrder, "status" | "paidAt">): string {
  return order.status === "paid" && order.paidAt
    ? t(locale, "workspace.statusPaidOn", { date: formatDate(locale, order.paidAt) })
    : statusText(locale, order.status);
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

// "≈ 8.7 h · +3 days", "≈ 8.7시간 · +3일"; hours to one decimal.
export function effortLine(locale: Locale, hours: number, days: number): string {
  const h = formatNumber(locale, Number(hours.toFixed(1)));
  return `${t(locale, "ticket.hours", { hours: h })} · +${tCount(locale, "delivery.days", days)}`;
}
