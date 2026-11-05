"use client";

import { useState, type ReactNode } from "react";

// The change order a visitor can act on right away: the first draft or sent one, and the message that asked for it.
export interface GuideTarget {
  href: string; // in-page link to the order's margin note
  author: string; // first name of the client who wrote the message
  sentOn: string; // the message's short date ("Oct 28")
}

interface DemoGuideProps {
  client: string;
  reviewBlockedReason: string | null; // set when this server can't call Claude, so step 1 can't be tried here
  target: GuideTarget | null;
  defaultOpen: boolean; // open on a fresh copy; folded once the copy has activity
}

interface StepProps {
  n: number;
  children: ReactNode;
}

const LINK = "font-semibold underline decoration-mark underline-offset-4 hover:decoration-ink";

// What a first-time visitor (usually a judge) needs before touching anything: what Tollgate does, the three steps
// to try, and that the copy is theirs. A <details> element, so it folds without extra code and stays reachable by
// keyboard. It opens on a fresh copy and starts folded once the copy has activity (the visitor has been here). The
// first value is kept, so a refresh after an action never folds it under the visitor's hands.
export function DemoGuide({ client, reviewBlockedReason, target, defaultOpen }: DemoGuideProps) {
  const [open] = useState(defaultOpen);

  return (
    <details open={open} className="group border-b border-rule bg-paper" data-testid="demo-guide">
      <summary className="mx-auto flex max-w-6xl cursor-pointer list-none items-baseline justify-between gap-4 px-4 py-3 text-sm sm:px-8 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold">How this demo works.</span>{" "}
          <span className="text-ink-soft">
            Tollgate finds the extra work hiding in a client&apos;s message and bills it through PayPal before you build it.
          </span>
        </span>
        <span className="shrink-0 text-ink-soft underline underline-offset-4">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-8">
        <ol className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <Step n={1}>
            {reviewBlockedReason === null ? (
              <>
                Paste a new message from {client}, or press <b>Use a sample message</b>, then <b>Check scope</b>.
              </>
            ) : target ? (
              <>
                Live Claude checks are off on this public demo. {target.author}&apos;s {target.sentOn} message already has a{" "}
                <a href={target.href} className={LINK}>
                  marked request
                </a>{" "}
                — start at step 3.
              </>
            ) : (
              <>
                Live Claude checks are off on this public demo. The requests already marked in {client}&apos;s messages
                show what a check finds; <b>Reset demo</b> brings back one to send.
              </>
            )}
          </Step>
          <Step n={2}>
            Claude marks what the agreed scope doesn&apos;t cover and estimates the hours. The price is your hourly rate
            times those hours. Nothing is sent yet.
          </Step>
          <Step n={3}>
            Press <b>Send change order</b> to send a PayPal sandbox invoice. When the client pays it, the work unlocks,
            the launch moves, and the total turns green.
            {target && (
              <>
                {" "}
                <a href={target.href} className={`whitespace-nowrap ${LINK}`}>
                  Go to the change order
                </a>
              </>
            )}
          </Step>
        </ol>
        <p className="mt-3 text-xs text-ink-soft">
          This copy is yours alone; <b className="font-semibold">Reset demo</b> puts it back. PayPal runs in sandbox mode,
          so no real money moves.
        </p>
      </div>
    </details>
  );
}

function Step({ n, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="font-serif text-[20px] leading-none text-ink-soft tabular-nums">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
