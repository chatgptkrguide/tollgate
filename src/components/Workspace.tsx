import { ActivityPanel } from "@/components/ActivityPanel";
import { BarrierGlyph } from "@/components/BarrierGlyph";
import { Conversation } from "@/components/Conversation";
import { CountingAmount } from "@/components/CountingAmount";
import { DeliveryPanel } from "@/components/DeliveryPanel";
import { DemoGuide, type GuideTarget } from "@/components/DemoGuide";
import { LinkHighlighter } from "@/components/LinkHighlighter";
import type { SeenSnapshot } from "@/components/motion-events";
import { MotionDirector } from "@/components/MotionDirector";
import { noteId } from "@/components/order-text";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { ResetDemo } from "@/components/ResetDemo";
import { ScopePanel } from "@/components/ScopePanel";
import { Ticket } from "@/components/Ticket";
import type { ActivityEvent } from "@/domain/activity";
import { isUnpaid } from "@/domain/change-order";
import { formatShortDate } from "@/domain/dates";
import { formatUsd } from "@/domain/money";
import type { ChangeOrder, Finding } from "@/domain/types";
import type { WorkspaceData } from "@/domain/workspace";

export interface WorkspaceProps {
  data: WorkspaceData;
  activity: readonly ActivityEvent[]; // oldest first
  sendBlockedReason: string | null; // set when this server has no PayPal keys, so sending and cancelling are off
  reviewBlockedReason: string | null; // set when this server has no Claude key, so checking a message is off
}

interface TicketEntry {
  finding: Finding;
  order: ChangeOrder;
  author: string;
  askedOn: string;
}

interface ProjectHeaderProps {
  data: WorkspaceData;
  client: string;
}

interface TicketsColumnProps {
  entries: readonly TicketEntry[];
  sendBlockedReason: string | null;
  className?: string;
}

// The first change order the visitor can act on (draft or sent) and the message that asked for it, for the guide.
function guideTarget(data: WorkspaceData): GuideTarget | null {
  const order = data.changeOrders.find(isUnpaid);
  const message = order && data.messages.find((m) => m.findings.some((f) => f.order?.id === order.id));
  if (!order || !message) return null;
  return { href: `#${noteId(order)}`, author: message.author.split(" ")[0], sentOn: formatShortDate(message.sentAt) };
}

// One ticket per marked phrase, showing its live order (or the cancelled one, until it's quoted again). Newest message
// first, so a ticket Claude just printed lands at the top of the column. Keyed by finding: quoting a cancelled order
// again shows a new order on the same ticket, which stays mounted so its buttons can move focus to the new status.
function ticketEntries(data: WorkspaceData): TicketEntry[] {
  const entries: TicketEntry[] = [];
  for (const message of [...data.messages].reverse()) {
    for (const { finding, order } of message.findings) {
      if (order) entries.push({ finding, order, author: message.author.split(" ")[0], askedOn: message.sentAt });
    }
  }
  return entries;
}

// What this render shows, for MotionDirector to compare with what the tab drew last.
function seenSnapshot(data: WorkspaceData, activity: readonly ActivityEvent[]): string {
  const snapshot: SeenSnapshot = {
    orders: Object.fromEntries(data.changeOrders.map((o) => [o.id, o.status])),
    activity: activity.reduce((max, e) => Math.max(max, e.id), 0),
    launch: data.delivery.launch,
  };
  return JSON.stringify(snapshot);
}

// The whole screen is rendered on the server from the database; only the action forms and the small motion helpers
// run in the browser.
export function Workspace({ data, activity, sendBlockedReason, reviewBlockedReason }: WorkspaceProps) {
  const { project } = data;
  const client = data.messages.find((m) => m.from === "client")?.author ?? project.clientName;
  const awaitingPayment = data.changeOrders.some((o) => o.status === "sent");

  return (
    <div className="min-h-dvh" data-testid="workspace" data-project-id={project.id}>
      {awaitingPayment && <RefreshOnReturn />}
      <MotionDirector projectId={project.id} snapshot={seenSnapshot(data, activity)} />
      <LinkHighlighter />

      <div className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-4 px-4 py-2 sm:px-8">
          <p className="flex items-center gap-2 pt-0.5 font-display text-[20px] font-extrabold tracking-[-0.01em]">
            <BarrierGlyph size={28} />
            Tollgate
          </p>
          <span aria-hidden="true" className="hidden h-6 w-px bg-line md:block" />
          <p className="hidden min-w-0 truncate pt-0.5 font-display text-[15px] text-ink-2 md:block">
            <span className="font-bold text-ink">{project.clientName}</span>
            <span className="mx-2">/</span>
            {project.title}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {/* Reserved for the language switcher. */}
            <div id="locale-slot" />
            <ResetDemo projectId={project.id} />
          </div>
        </div>
      </div>

      <DemoGuide client={client} reviewBlockedReason={reviewBlockedReason} target={guideTarget(data)} defaultOpen={activity.length === 0} />
      <ProjectHeader data={data} client={client} />

      {/* Tickets come first in the page, so on a phone they sit right under the total; on a wide screen they head the
          right column and the conversation spans both rows on the left. */}
      <main className="mx-auto grid max-w-[1280px] gap-6 px-4 pt-6 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-8">
        <TicketsColumn entries={ticketEntries(data)} sendBlockedReason={sendBlockedReason} className="lg:col-start-2 lg:row-start-1" />
        <Conversation
          messages={data.messages}
          clientName={project.clientName}
          client={client}
          reviewBlockedReason={reviewBlockedReason}
          className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
        />
        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <DeliveryPanel plan={data.delivery} />
          <ScopePanel data={data} />
          <ActivityPanel activity={activity} />
        </div>
      </main>
    </div>
  );
}

function ProjectHeader({ data, client }: ProjectHeaderProps) {
  const { project, totals } = data;
  const tone = totals.hasUnpaid ? "stop" : "go";

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-x-10 gap-y-5 px-4 py-6 sm:px-8">
        <div>
          <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.015em]">{project.clientName}</h1>
          <p className="mt-1 text-ink-2">
            {project.title} · {client} · agreed {formatShortDate(project.agreedOn)}
          </p>
        </div>
        <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <dt className="font-display text-[13px] font-bold text-ink-2">Agreed</dt>
            <dd className="mt-1.5 font-display text-[24px] leading-none font-bold text-ink-2 tabular-nums">{formatUsd(totals.agreedCents)}</dd>
          </div>
          <div data-testid="header-total" data-fx-total="" data-tone={tone}>
            <dt className="font-display text-[13px] font-bold text-ink-2">Total with changes</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={`total-figure pt-1 font-display text-[44px] leading-none font-extrabold tracking-[-0.02em] tabular-nums ${totals.hasUnpaid ? "text-stop" : "text-go"}`}>
                <CountingAmount cents={totals.totalCents} />
              </span>
              <span className="chip">
                <span className="lamp" aria-hidden="true" />
                {totals.unpaidCents > 0 ? `${formatUsd(totals.unpaidCents)} not paid yet` : "All paid"}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function TicketsColumn({ entries, sendBlockedReason, className = "" }: TicketsColumnProps) {
  const open = entries.filter((e) => isUnpaid(e.order)).length;

  return (
    <section aria-labelledby="tickets-title" className={`min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="tickets-title" className="font-display text-[20px] leading-tight font-bold">
          Tickets
        </h2>
        <p className="font-mono text-[12px] text-ink-2">
          {entries.length} {entries.length === 1 ? "ticket" : "tickets"} · {open} open
        </p>
      </div>
      {/* The slot new tickets print out of. */}
      <div aria-hidden="true" className="ticket-slot relative z-10 mt-3" />
      {entries.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          No tickets yet. When Claude finds a request outside the agreed scope, it prints a ticket here.
        </p>
      ) : (
        <ol className="ticket-row -mx-4 -mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-0 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-2 lg:pb-0">
          {entries.map((e) => (
            <li key={e.finding.id} className="w-[min(360px,calc(100vw-56px))] shrink-0 snap-start lg:w-auto">
              <Ticket order={e.order} finding={e.finding} author={e.author} askedOn={e.askedOn} sendBlockedReason={sendBlockedReason} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
