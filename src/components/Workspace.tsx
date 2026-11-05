import type { ReactNode } from "react";
import { ChangeOrderActions } from "@/components/ChangeOrderActions";
import { Composer } from "@/components/Composer";
import { DeliveryPanel } from "@/components/DeliveryPanel";
import { DemoGuide } from "@/components/DemoGuide";
import { ResetDemo } from "@/components/ResetDemo";
import type { ActivityActor, ActivityEvent } from "@/domain/activity";
import { formatShortDate } from "@/domain/dates";
import { formatUsd } from "@/domain/money";
import { segmentBody, type BodySegment } from "@/domain/segments";
import type { ChangeOrder, ChangeOrderStatus } from "@/domain/types";
import type { FindingWithOrder, ThreadMessage, WorkspaceData } from "@/domain/workspace";

export interface WorkspaceProps {
  data: WorkspaceData;
  activity: readonly ActivityEvent[]; // oldest first
  sendBlockedReason: string | null; // set when this server has no PayPal keys, so sending and cancelling are off
  reviewBlockedReason: string | null; // set when this server has no Claude key, so checking a message is off
}

const statusText: Record<ChangeOrderStatus, string> = {
  draft: "Waiting for your review",
  sent: "Sent to client, not paid yet",
  paid: "Paid",
  waived: "Included at no charge",
  cancelled: "Cancelled",
};

const statusColor: Record<ChangeOrderStatus, string> = {
  draft: "text-mark",
  sent: "text-mark",
  paid: "text-paid",
  waived: "text-ink-soft",
  cancelled: "text-ink-soft",
};

const noteLine: Record<ChangeOrderStatus, string> = {
  draft: "border-mark",
  sent: "border-mark",
  paid: "border-paid",
  waived: "border-rule",
  cancelled: "border-rule",
};

// Shown but not billed, so struck through in the totals panel.
const notCounted = (status: ChangeOrderStatus) => status === "waived" || status === "cancelled";

const noteId = (order: ChangeOrder) => `note-${order.id}`;
const statusLineId = (order: ChangeOrder) => `status-${order.id}`;
const titleId = (order: ChangeOrder) => `title-${order.id}`;

function statusLine(order: ChangeOrder): string {
  return order.status === "paid" && order.paidAt ? `${statusText.paid} ${formatShortDate(order.paidAt)}` : statusText[order.status];
}

const moreDays = (days: number) => `about ${days} more ${days === 1 ? "day" : "days"}`;

// The whole screen is rendered on the server from the database; only the action forms run in the browser.
export function Workspace({ data, activity, sendBlockedReason, reviewBlockedReason }: WorkspaceProps) {
  const { project, totals } = data;
  const client = data.messages.find((m) => m.from === "client")?.author ?? project.clientName;

  return (
    <div className="min-h-dvh" data-testid="workspace" data-project-id={project.id}>
      <DemoGuide client={client} />
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <p className="pt-3 text-sm font-semibold tracking-tight">Tollgate</p>
            <ResetDemo projectId={project.id} />
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div>
              <h1 className="font-serif text-[28px] leading-tight">{project.clientName}</h1>
              <p className="text-ink-soft">{project.title}</p>
            </div>
            <dl className="flex gap-8 tabular-nums">
              <div>
                <dt className="text-sm text-ink-soft">Agreed</dt>
                <dd className="text-[22px]">{formatUsd(totals.agreedCents)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-soft">With changes</dt>
                <dd className={`text-[22px] font-semibold ${totals.hasUnpaid ? "text-mark" : "text-paid"}`}>
                  {formatUsd(totals.totalCents)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* Delivery comes first in the page, so on a phone it sits right under the totals; on a wide screen it heads the
          right column and the conversation spans both rows on the left. */}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-start">
        <DeliveryPanel plan={data.delivery} className="lg:col-start-2 lg:row-start-1" />

        <section aria-labelledby="thread-title" className="rounded-md border border-rule bg-sheet lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <h2 id="thread-title" className="sr-only">
            Conversation with {project.clientName}
          </h2>
          <ol>
            {data.messages.map((m) => (
              <MessageRow key={m.id} message={m} sendBlockedReason={sendBlockedReason} />
            ))}
          </ol>
          <Composer client={client} blockedReason={reviewBlockedReason} />
        </section>

        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <ScopePanel data={data} />
          <ActivityPanel activity={activity} />
        </div>
      </main>
    </div>
  );
}

interface MessageRowProps {
  message: ThreadMessage;
  sendBlockedReason: string | null;
}

function MessageRow({ message, sendBlockedReason }: MessageRowProps) {
  // Every finding is stored with its change order; one without any isn't drawn.
  const quoted = message.findings.filter((f): f is FindingWithOrder & { order: ChangeOrder } => f.order !== null);

  return (
    <li className="grid gap-x-8 gap-y-4 border-b border-rule px-5 py-6 last:border-b-0 sm:px-8 md:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{message.author}</span>
          <span className="ml-2">{formatShortDate(message.sentAt)}</span>
        </p>
        <p className={`mt-2 max-w-[62ch] font-serif text-[17px] leading-[1.65] ${message.from === "me" ? "text-ink-soft" : ""}`}>
          <MarkedBody body={message.body} quoted={quoted} />
        </p>
      </div>
      {quoted.length > 0 && (
        <div className="space-y-6">
          {/* Keyed by finding: quoting a cancelled order again shows a new order in the same note, which stays
              mounted so its buttons can move focus to the new status. */}
          {quoted.map(({ finding, order }) => (
            <MarginNote
              key={finding.id}
              quote={finding.quote}
              reason={finding.reason}
              order={order}
              sendBlockedReason={sendBlockedReason}
            />
          ))}
        </div>
      )}
    </li>
  );
}

interface MarkedBodyProps {
  body: string;
  quoted: readonly (FindingWithOrder & { order: ChangeOrder })[];
}

// Marks each quote at its stored offsets; a span that doesn't match the text is left unmarked.
function MarkedBody({ body, quoted }: MarkedBodyProps) {
  const orderOf = new Map(quoted.map(({ finding, order }) => [finding.id, order]));
  const segments = segmentBody(
    body,
    quoted.map(({ finding }) => ({ id: finding.id, start: finding.quoteStart, end: finding.quoteEnd, quote: finding.quote })),
  );

  // Each segment starts at a different offset, which makes a stable key.
  const parts: ReactNode[] = [];
  let at = 0;
  for (const segment of segments) {
    parts.push(<Segment key={`${segment.kind}-${at}`} segment={segment} order={segment.kind === "mark" ? orderOf.get(segment.id) : undefined} />);
    at += segment.text.length;
  }
  return <>{parts}</>;
}

interface SegmentProps {
  segment: BodySegment;
  order: ChangeOrder | undefined;
}

function Segment({ segment, order }: SegmentProps) {
  if (segment.kind === "text" || !order) return <>{segment.text}</>;
  // Described by the note's status and title only: the whole note would include its button names.
  // Few screen readers read a description on text that takes no focus, so the note also quotes the mark.
  return (
    <mark
      className="scope-mark"
      data-status={order.status}
      data-animate={order.status === "draft"}
      aria-describedby={`${statusLineId(order)} ${titleId(order)}`}
    >
      {segment.text}
    </mark>
  );
}

interface MarginNoteProps {
  quote: string;
  reason: string;
  order: ChangeOrder;
  sendBlockedReason: string | null;
}

function MarginNote({ quote, reason, order, sendBlockedReason }: MarginNoteProps) {
  const open = order.status === "draft";

  return (
    // role="note": a margin note belongs to its message, not a landmark of its own. The element stays an
    // aside because the design's test hooks select aside[data-change-order-id].
    <aside
      id={noteId(order)}
      role="note"
      className={`margin-note border-l-2 pl-4 ${noteLine[order.status]}`}
      data-animate={open}
      data-change-order-id={order.id}
      data-status={order.status}
    >
      {/* Takes focus after an action (the pressed button is gone), and announces the new status. */}
      <p id={statusLineId(order)} role="status" tabIndex={-1} className={`text-sm font-semibold ${statusColor[order.status]}`}>
        {open ? "Not in the agreed scope" : statusLine(order)}
      </p>
      <p className="sr-only">Marked in the message: “{quote}”</p>
      <p id={titleId(order)} className="mt-1 font-serif text-[17px] leading-snug">
        {order.title}
      </p>
      <p className="mt-1 tabular-nums">
        <span className="font-semibold">+{formatUsd(order.amountCents)}</span>
        <span className="ml-2 text-sm text-ink-soft">{moreDays(order.extraDays)}</span>
      </p>
      {open && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{reason}</p>}
      {/* Rendered for every status (it draws nothing once paid or waived), so it stays mounted through the
          refresh after an action and can move focus to the status line. */}
      <ChangeOrderActions
        order={{ id: order.id, status: order.status, payerViewUrl: order.payerViewUrl, hasInvoice: order.paypalInvoiceId !== null }}
        sendBlockedReason={sendBlockedReason}
        statusLineId={statusLineId(order)}
      />
    </aside>
  );
}

interface ScopePanelProps {
  data: WorkspaceData;
}

function ScopePanel({ data }: ScopePanelProps) {
  const { project, scopeItems, changeOrders, totals } = data;

  return (
    <section aria-labelledby="scope-title" className="rounded-md border border-rule bg-sheet px-5 py-6">
      <h2 id="scope-title" className="font-serif text-[22px]">
        Scope
      </h2>
      <p className="text-sm text-ink-soft">Version 1, agreed {formatShortDate(project.agreedOn)}</p>
      <ul className="mt-4 divide-y divide-rule border-y border-rule">
        {scopeItems.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-2.5">
            <span className="font-serif">{item.title}</span>
            <span className="tabular-nums">{formatUsd(item.amountCents)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-7 font-serif text-[18px]">Change orders</h3>
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {changeOrders.map((o) => {
          const struck = notCounted(o.status) ? "text-ink-soft line-through" : "";
          return (
            <li key={o.id} className="py-2.5">
              <div className="flex justify-between gap-4">
                <span className={`font-serif ${struck}`}>{o.title}</span>
                <span className={`tabular-nums ${struck}`}>+{formatUsd(o.amountCents)}</span>
              </div>
              <p className={`text-sm ${statusColor[o.status]}`}>{statusLine(o)}</p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 space-y-1 tabular-nums">
        <div className="flex justify-between text-ink-soft">
          <dt>Agreed</dt>
          <dd>{formatUsd(totals.agreedCents)}</dd>
        </div>
        <div className="flex justify-between text-ink-soft">
          <dt>Change orders</dt>
          <dd>+{formatUsd(totals.changeOrdersCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-rule pt-2 text-[18px] font-semibold">
          <dt>Total</dt>
          <dd>{formatUsd(totals.totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

const actorText: Record<ActivityActor, string> = {
  app: "Tollgate",
  claude: "Claude",
  paypal: "PayPal",
};

interface ActivityPanelProps {
  activity: readonly ActivityEvent[];
}

// What happened, in order. It only explains: nothing here can start a PayPal call.
function ActivityPanel({ activity }: ActivityPanelProps) {
  return (
    <section aria-labelledby="activity-title" className="rounded-md border border-rule bg-sheet px-5 py-6" data-testid="activity-panel">
      <h2 id="activity-title" className="font-serif text-[22px]">
        Activity
      </h2>
      <p className="text-sm text-ink-soft">Claude proposes. Nothing reaches PayPal until you press a button.</p>
      {activity.length === 0 ? (
        <p className="mt-4 border-t border-rule pt-3 text-sm leading-relaxed text-ink-soft">
          Nothing yet. Check a message or send a change order, and each step shows up here.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-rule border-y border-rule">
          {activity.map((event) => (
            <li key={event.id} className="py-2.5 text-sm leading-relaxed" data-kind={event.kind}>
              <span className="font-semibold">{actorText[event.actor]}</span> {event.summary}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
