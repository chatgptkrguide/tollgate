import type { ReactNode } from "react";
import { Composer } from "@/components/Composer";
import { ThreadScroll } from "@/components/ThreadScroll";
import { noteId, quoteId, statusLineId, titleId } from "@/components/order-text";
import { formatShortDate } from "@/domain/dates";
import { segmentBody, type BodySegment } from "@/domain/segments";
import type { ChangeOrder } from "@/domain/types";
import type { FindingWithOrder, ThreadMessage } from "@/domain/workspace";

export interface ConversationProps {
  messages: readonly ThreadMessage[];
  clientName: string; // the client company
  client: string; // the person who writes ("Maya Lindqvist")
  reviewBlockedReason: string | null;
  className?: string;
}

interface MessageBubbleProps {
  message: ThreadMessage;
}

type Quoted = FindingWithOrder & { order: ChangeOrder };

interface MarkedBodyProps {
  body: string;
  quoted: readonly Quoted[];
}

interface SegmentProps {
  segment: BodySegment;
  quoted: Quoted | undefined;
}

// The thread as a chat: the client's messages on the left, yours on the right, the composer at the bottom. On a wide
// screen the column sticks under the app bar and scrolls on its own, so the composer stays in reach.
export function Conversation({ messages, clientName, client, reviewBlockedReason, className = "" }: ConversationProps) {
  return (
    <section
      aria-labelledby="thread-title"
      className={`flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface lg:sticky lg:top-20 lg:max-h-[calc(100dvh-96px)] ${className}`}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3.5 sm:px-6">
        <h2 id="thread-title" className="font-display text-[17px] font-bold">
          Conversation <span className="sr-only">with {clientName}</span>
        </h2>
        <p className="hidden truncate text-[14px] text-ink-2 sm:block">
          {client} · {clientName}
        </p>
      </div>
      <ThreadScroll count={messages.length} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </ThreadScroll>
      <Composer client={client} blockedReason={reviewBlockedReason} />
    </section>
  );
}

function MessageBubble({ message }: MessageBubbleProps) {
  // Every finding is stored with its change order; one without any isn't drawn.
  const quoted = message.findings.filter((f): f is Quoted => f.order !== null);
  const mine = message.from === "me";

  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <p className="px-1 font-display text-[13px] text-ink-2">
        <span className="font-bold text-ink">{message.author}</span>
        <span className="ml-2 font-mono text-[12px]">{formatShortDate(message.sentAt)}</span>
      </p>
      <p
        className={`mt-1.5 max-w-[min(62ch,88%)] px-4 py-3 text-[16px] leading-[1.65] ${
          mine ? "rounded-[14px] rounded-tr-[4px] bg-ink text-white" : "rounded-[14px] rounded-tl-[4px] bg-canvas text-ink"
        }`}
      >
        <MarkedBody body={message.body} quoted={quoted} />
      </p>
      {quoted.length > 0 && (
        <p className="mt-1.5 px-1 font-mono text-[12px] text-ink-2">
          {quoted.length} {quoted.length === 1 ? "ticket" : "tickets"} from this message
        </p>
      )}
    </li>
  );
}

// Marks each quote at its stored offsets; a span that doesn't match the text is left unmarked.
function MarkedBody({ body, quoted }: MarkedBodyProps) {
  const byFinding = new Map(quoted.map((q) => [q.finding.id, q]));
  const segments = segmentBody(
    body,
    quoted.map(({ finding }) => ({ id: finding.id, start: finding.quoteStart, end: finding.quoteEnd, quote: finding.quote })),
  );

  // Each segment starts at a different offset, which makes a stable key.
  const parts: ReactNode[] = [];
  let at = 0;
  for (const segment of segments) {
    parts.push(<Segment key={`${segment.kind}-${at}`} segment={segment} quoted={segment.kind === "mark" ? byFinding.get(segment.id) : undefined} />);
    at += segment.text.length;
  }
  return <>{parts}</>;
}

function Segment({ segment, quoted }: SegmentProps) {
  if (segment.kind === "text" || !quoted) return <>{segment.text}</>;
  const { finding, order } = quoted;
  // The phrase links to its ticket, and is described by the ticket's status and title.
  return (
    <mark
      id={quoteId(finding.id)}
      className="scope-mark scroll-mt-28"
      data-status={order.status}
      data-animate={order.status === "draft"}
      data-link={finding.id}
    >
      <a href={`#${noteId(order)}`} aria-describedby={`${statusLineId(order)} ${titleId(order)}`}>
        {segment.text}
      </a>
    </mark>
  );
}
