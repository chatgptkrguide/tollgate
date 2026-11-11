import { ChangeOrderActions } from "@/components/ChangeOrderActions";
import { effortLine, noteId, quoteId, statusLine, statusLineId, statusTone, ticketNumber, titleId } from "@/components/order-text";
import type { ChangeOrder, ChangeOrderStatus, Finding } from "@/domain/types";
import { formatDate, formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";
import { env } from "@/server/env";

export interface TicketProps {
  order: ChangeOrder;
  finding: Finding;
  author: string; // first name of the client who asked for it
  askedOn: string; // ISO date of their message
  sendBlockedReason: string | null;
  readOnly: boolean; // the read-only preview: see ChangeOrderActions
  locale: Locale;
}

interface Gate {
  up: boolean; // the arm is raised: the work may go ahead
  caption: string; // what the gate means for the work, under the arm
  stamp: { text: string; tone: "go" | "idle" | "ink" } | null;
}

// The stub tells the same story as the status line, with the barrier: down while unpaid, up once paid or included.
// The stamp is a graphic in the stub (aria-hidden): the status line says the same for screen readers.
function gateOf(locale: Locale, order: ChangeOrder): Gate {
  const paid = order.paidAt ? t(locale, "ticket.stampPaidOn", { date: formatDate(locale, order.paidAt) }) : t(locale, "ticket.stampPaid");
  const gates: Record<ChangeOrderStatus, Gate> = {
    draft: { up: false, caption: t(locale, "ticket.gateLocked"), stamp: null },
    sent: { up: false, caption: t(locale, "ticket.gateLocked"), stamp: { text: t(locale, "ticket.stampSent"), tone: "ink" } },
    paid: { up: true, caption: t(locale, "ticket.gateUnlocked"), stamp: { text: paid, tone: "go" } },
    waived: { up: true, caption: t(locale, "ticket.gateWaived"), stamp: { text: t(locale, "ticket.stampWaived"), tone: "idle" } },
    cancelled: { up: false, caption: t(locale, "ticket.gateCancelled"), stamp: { text: t(locale, "ticket.stampVoid"), tone: "idle" } },
  };
  return gates[order.status];
}

// One change order as a toll ticket: number and lamp, what and how much, where it came from, then a perforation and
// the stub with the barrier and the buttons. The element stays an aside[data-change-order-id] with role="note":
// the e2e tests and the guide's links find tickets that way. It can take focus (tabIndex -1, named by its title) so
// a ticket Check scope printed off screen can be brought to (reveal-ticket).
export function Ticket({ order, finding, author, askedOn, sendBlockedReason, readOnly, locale }: TicketProps) {
  const tone = statusTone[order.status];
  const gate = gateOf(locale, order);
  const number = ticketNumber(order.id);
  const hasActions = order.status === "draft" || order.status === "sent" || order.status === "cancelled";

  return (
    <aside
      id={noteId(order)}
      role="note"
      aria-labelledby={titleId(order)}
      tabIndex={-1}
      className="ticket scroll-mt-24 scroll-ml-4 lg:scroll-mt-44"
      data-status={order.status}
      data-change-order-id={order.id}
      data-fx-order={order.id}
      data-link={finding.id}
      data-gate={gate.up ? "up" : "down"}
      data-gate-tone={tone === "idle" ? "idle" : "ink"}
      data-tone={tone}
    >
      <div className="px-5 pt-4 pb-3">
        <p className="truncate font-mono text-[12px] leading-5 tracking-[0.04em] text-ink-2">
          <span className="font-semibold text-ink">{t(locale, "ticket.label")}</span>
          {number && <span className="ml-2">{number}</span>}
        </p>
        {/* Takes focus after an action (the pressed button is gone), and announces the new status. */}
        <p
          id={statusLineId(order)}
          role="status"
          tabIndex={-1}
          className="mt-2 flex items-center gap-2 font-display text-[14px] leading-5 font-bold text-(--tone-ink)"
        >
          <span className="lamp" aria-hidden="true" />
          {statusLine(locale, order)}
        </p>
        <h3 id={titleId(order)} className="mt-3 font-display text-[20px] leading-tight font-bold text-ink">
          {order.title}
        </h3>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`font-display text-[34px] leading-none font-extrabold tracking-[-0.02em] tabular-nums ${order.status === "waived" || order.status === "cancelled" ? "text-ink-2 line-through decoration-2" : "text-ink"}`}>
            {formatMoney(locale, order.amountCents)}
          </span>
          <span className="font-mono text-[13px] text-ink-2">{effortLine(locale, order.hours, order.extraDays)}</span>
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          {t(locale, "ticket.asked", { author, date: formatDate(locale, askedOn) })}{" "}
          <a href={`#${quoteId(finding.id)}`} className="-mx-1 px-1 py-1.5 text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink-2">
            <span className="sr-only">{t(locale, "ticket.showInMessage")}</span>“{finding.quote}”
          </a>
        </p>
        {order.status === "draft" && (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{t(locale, "ticket.notInScope")}</span> {finding.reason}
          </p>
        )}
      </div>

      <div className="perf" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className={`lane ${hasActions ? "" : "border-b-0"}`} aria-hidden="true">
        <span className="lane-rest" />
        <span className="lane-arm" />
        <span className="lane-post" />
        <span className="lane-caption">{gate.caption}</span>
        {gate.stamp && (
          <span className="stamp" data-tone={gate.stamp.tone}>
            {gate.stamp.text}
          </span>
        )}
      </div>

      {/* Rendered for every status (it draws nothing once paid or waived), so it stays mounted through the refresh
          after an action and can move focus to the status line. */}
      <div className={hasActions ? "px-5 pb-5" : ""}>
        <ChangeOrderActions
          order={{ id: order.id, status: order.status, payerViewUrl: order.payerViewUrl, hasInvoice: order.paypalInvoiceId !== null }}
          sendBlockedReason={sendBlockedReason}
          readOnly={readOnly}
          sandbox={env().PAYPAL_ENV === "sandbox"} // the simulated-payment shortcut; its action checks again
          statusLineId={statusLineId(order)}
          locale={locale}
        />
      </div>
    </aside>
  );
}
