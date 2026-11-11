import { ActivityPanel } from "@/components/ActivityPanel";
import { BarrierGlyph } from "@/components/BarrierGlyph";
import { ClientLocaleSelect } from "@/components/ClientLocaleSelect";
import { Conversation } from "@/components/Conversation";
import { DeliveryPanel } from "@/components/DeliveryPanel";
import { DemoGuide, type GuideTarget } from "@/components/DemoGuide";
import { LinkHighlighter } from "@/components/LinkHighlighter";
import type { SeenSnapshot } from "@/components/motion-events";
import { MotionDirector } from "@/components/MotionDirector";
import { noteId } from "@/components/order-text";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";
import { ResetDemo } from "@/components/ResetDemo";
import { ResultRail } from "@/components/ResultRail";
import { ScopePanel } from "@/components/ScopePanel";
import { Ticket } from "@/components/Ticket";
import { actionFirst } from "@/components/ticket-order";
import type { ActivityEvent } from "@/domain/activity";
import { isUnpaid } from "@/domain/change-order";
import type { ChangeOrder, Finding } from "@/domain/types";
import type { WorkspaceData } from "@/domain/workspace";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { LocaleSwitcher } from "@/i18n/LocaleSwitcher";
import { t, tCount } from "@/i18n/t";

export interface WorkspaceProps {
  data: WorkspaceData;
  activity: readonly ActivityEvent[]; // oldest first
  sendBlockedReason: string | null; // set when this server has no PayPal keys, so sending and cancelling are off
  reviewBlockedReason: string | null; // set when this server has no Claude key, so checking a message is off
  // Set when a new copy was refused (demo-limit.ts): data is the seed from memory and nothing can be saved, so the
  // screen says so, and resetting and the client language are off. The page passes it as both reasons above too.
  previewReason: string | null;
  guideOpen: boolean; // the visitor left the demo guide open (guide-state.ts)
  locale: Locale; // the screen language of this request (getLocale())
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
  readOnly: boolean;
  locale: Locale;
}

interface TicketsColumnProps {
  entries: readonly TicketEntry[];
  sendBlockedReason: string | null;
  readOnly: boolean;
  locale: Locale;
}

// The first change order the visitor can act on (draft or sent) and the message that asked for it, for the guide.
function guideTarget(data: WorkspaceData, locale: Locale): GuideTarget | null {
  const order = data.changeOrders.find(isUnpaid);
  const message = order && data.messages.find((m) => m.findings.some((f) => f.order?.id === order.id));
  if (!order || !message) return null;
  return { href: `#${noteId(order)}`, author: message.author.split(" ")[0], sentOn: formatDate(locale, message.sentAt) };
}

// One ticket per marked phrase, showing its live order (or the cancelled one, until it's quoted again). The ones to
// act on come first (actionFirst), and within each group the newest message, so a ticket Claude just printed lands at
// the top of the column. Keyed by finding: quoting a cancelled order again shows a new order on the same ticket, which
// stays mounted (and moves up with its new status) so its buttons can move focus to the new status.
function ticketEntries(data: WorkspaceData): TicketEntry[] {
  const entries: TicketEntry[] = [];
  for (const message of [...data.messages].reverse()) {
    for (const { finding, order } of message.findings) {
      if (order) entries.push({ finding, order, author: message.author.split(" ")[0], askedOn: message.sentAt });
    }
  }
  return actionFirst(entries);
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
export function Workspace({ data, activity, sendBlockedReason, reviewBlockedReason, previewReason, guideOpen, locale }: WorkspaceProps) {
  const { project } = data;
  const client = data.messages.find((m) => m.from === "client")?.author ?? project.clientName;
  const awaitingPayment = data.changeOrders.some((o) => o.status === "sent");

  return (
    <div className="min-h-dvh" data-testid="workspace" data-project-id={project.id}>
      {awaitingPayment && <RefreshOnReturn />}
      <MotionDirector projectId={project.id} snapshot={seenSnapshot(data, activity)} />
      <LinkHighlighter />

      {/* The page banner: the only <header> outside <main> (ProjectHeader below is a named section). */}
      <header data-top-bar="" className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-[1280px] items-center gap-3 px-4 py-2 sm:gap-4 sm:px-8">
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
          <div className="ml-auto flex items-center gap-1 sm:gap-4">
            <div id="locale-slot">
              <LocaleSwitcher locale={locale} label={t(locale, "localeSwitcher.label")} />
            </div>
            {previewReason === null && <ResetDemo projectId={project.id} locale={locale} />}
          </div>
        </div>
      </header>

      {/* The guide also carries the view-only notice when previewReason is set. */}
      <DemoGuide
        client={client}
        reviewBlockedReason={reviewBlockedReason}
        target={guideTarget(data, locale)}
        readOnly={previewReason !== null}
        defaultOpen={guideOpen}
        locale={locale}
      />
      <ProjectHeader data={data} client={client} readOnly={previewReason !== null} locale={locale} />

      {/* The result rail and the tickets come first in the page, so on a phone the tickets sit right under the rail's
          one-line bar; on a wide screen they head the right column and the conversation spans both rows on the left.
          Below 1024 px main is a flex column, not a grid, and the rail's wrapper is display: contents: a sticky grid
          item only sticks inside its own row, and the phone bar has to stick for the whole page. On a wide screen the
          wrapper is the rail's containing block, so the rail sticks while the tickets scroll under it. */}
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-8">
        <div className="contents lg:col-start-2 lg:row-start-1 lg:block lg:space-y-6">
          <ResultRail data={data} locale={locale} />
          <TicketsColumn entries={ticketEntries(data)} sendBlockedReason={sendBlockedReason} readOnly={previewReason !== null} locale={locale} />
        </div>
        <Conversation
          messages={data.messages}
          clientName={project.clientName}
          client={client}
          reviewBlockedReason={reviewBlockedReason}
          locale={locale}
          className="lg:col-start-1 lg:row-span-2 lg:row-start-1"
        />
        <div className="space-y-6 lg:col-start-2 lg:row-start-2">
          <DeliveryPanel plan={data.delivery} locale={locale} />
          <ScopePanel data={data} locale={locale} />
          <ActivityPanel activity={activity} locale={locale} />
        </div>
      </main>
    </div>
  );
}

// One row on a wide screen: who the project is for and the client's invoice language. The totals it used to carry
// are in the result rail.
function ProjectHeader({ data, client, readOnly, locale }: ProjectHeaderProps) {
  const { project } = data;

  return (
    <section aria-labelledby="project-title" className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3 sm:px-8">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 id="project-title" className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.015em]">{project.clientName}</h1>
          <p className="text-[15px] text-ink-2">
            {project.title} · {client} · {t(locale, "workspace.agreedOn", { date: formatDate(locale, project.agreedOn) })}
          </p>
        </div>
        <ClientLocaleSelect
          projectId={project.id}
          clientLocale={project.clientLocale}
          label={t(locale, "clientLocale.label")}
          help={t(locale, "clientLocale.help")}
          saveFailed={t(locale, "clientLocale.saveFailed")}
          disabled={readOnly}
        />
      </div>
    </section>
  );
}

function TicketsColumn({ entries, sendBlockedReason, readOnly, locale }: TicketsColumnProps) {
  const open = entries.filter((e) => isUnpaid(e.order)).length;

  return (
    <section aria-labelledby="tickets-title" className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="tickets-title" className="font-display text-[20px] leading-tight font-bold">
          {t(locale, "tickets.title")}
        </h2>
        <p className="font-mono text-[13px] text-ink-2">
          {tCount(locale, "tickets.count", entries.length)} · {tCount(locale, "tickets.open", open)}
        </p>
      </div>
      {/* The slot new tickets print out of. */}
      <div aria-hidden="true" className="ticket-slot relative z-10 mt-3" />
      {entries.length === 0 ? (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          {t(locale, "tickets.empty")}
        </p>
      ) : (
        <ol className="ticket-row -mx-4 -mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-0 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-col lg:gap-4 lg:overflow-visible lg:px-2 lg:pb-0">
          {entries.map((e) => (
            <li key={e.finding.id} className="w-[min(360px,calc(100vw-56px))] shrink-0 snap-start scroll-mt-12 lg:w-auto lg:scroll-mt-40">
              <Ticket order={e.order} finding={e.finding} author={e.author} askedOn={e.askedOn} sendBlockedReason={sendBlockedReason} readOnly={readOnly} locale={locale} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
