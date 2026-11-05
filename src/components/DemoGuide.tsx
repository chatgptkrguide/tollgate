import type { ReactNode } from "react";

interface DemoGuideProps {
  client: string;
}

interface StepProps {
  n: number;
  children: ReactNode;
}

// What a first-time visitor (usually a judge) needs before touching anything: what Tollgate does, the three steps
// to try, and that the copy is theirs. A <details> element, so it folds without client code and stays reachable by
// keyboard; it opens on every visit because the copy itself is short-lived.
export function DemoGuide({ client }: DemoGuideProps) {
  return (
    <details open className="group border-b border-rule bg-paper" data-testid="demo-guide">
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
            Paste a new message from {client}, or press <b>Use a sample message</b>, then <b>Check scope</b>.
          </Step>
          <Step n={2}>
            Claude marks what the agreed scope doesn&apos;t cover and estimates the hours. The price is your hourly rate
            times those hours. Nothing is sent yet.
          </Step>
          <Step n={3}>
            Press <b>Send change order</b> to send a PayPal sandbox invoice. When the client pays it, the work unlocks,
            the launch moves, and the total turns green.
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
      <span aria-hidden className="font-serif text-[20px] leading-none text-mark tabular-nums">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
