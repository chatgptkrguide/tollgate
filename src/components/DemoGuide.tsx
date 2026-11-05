"use client";

import { useState, type ReactNode } from "react";
import { Rich } from "@/components/Rich";
import type { Locale } from "@/i18n/locales";
import { t, tRich } from "@/i18n/t";

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
  locale: Locale;
}

interface StepProps {
  n: number;
  children: ReactNode;
}

// Links underline in ink: STOP red is kept for unpaid and locked work only.
const LINK = "font-semibold underline decoration-ink-2 decoration-2 underline-offset-4 hover:decoration-ink";

// What a first-time visitor (usually a judge) needs before touching anything: what Tollgate does, the three steps
// to try, and that the copy is theirs. A <details> element, so it folds without extra code and stays reachable by
// keyboard. It opens on a fresh copy and starts folded once the copy has activity (the visitor has been here). The
// first value is kept, so a refresh after an action never folds it under the visitor's hands.
export function DemoGuide({ client, reviewBlockedReason, target, defaultOpen, locale }: DemoGuideProps) {
  const [open] = useState(defaultOpen);
  const markedLink = (text: string) =>
    target && (
      <a href={target.href} className={LINK}>
        {text}
      </a>
    );

  return (
    <details open={open} className="group border-b border-line bg-canvas" data-testid="demo-guide">
      <summary className="mx-auto flex min-h-11 max-w-[1280px] cursor-pointer list-none items-baseline justify-between gap-4 px-4 py-2.5 text-[14px] sm:px-8 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-display font-bold">{t(locale, "guide.summaryTitle")}</span>{" "}
          <span className="text-ink-2">{t(locale, "guide.summaryText")}</span>
        </span>
        <span className="shrink-0 font-display font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4 group-hover:decoration-ink-2">
          <span className="group-open:hidden">{t(locale, "guide.show")}</span>
          <span className="hidden group-open:inline">{t(locale, "guide.hide")}</span>
        </span>
      </summary>
      <div className="mx-auto max-w-[1280px] px-4 pb-3 sm:px-8">
        <ol className="grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3">
          <Step n={1}>
            {reviewBlockedReason === null ? (
              <Rich parts={tRich(locale, "guide.step1Live", { client })} />
            ) : target ? (
              <Rich parts={tRich(locale, "guide.step1Target", { author: target.author, sentOn: target.sentOn })} link={markedLink} />
            ) : (
              <Rich parts={tRich(locale, "guide.step1NoTarget", { client })} />
            )}
          </Step>
          <Step n={2}>{t(locale, "guide.step2")}</Step>
          <Step n={3}>
            <Rich parts={tRich(locale, "guide.step3")} />
            {target && (
              <>
                {" "}
                <a href={target.href} className={`whitespace-nowrap ${LINK}`}>
                  {t(locale, "guide.goToOrder")}
                </a>
              </>
            )}
          </Step>
        </ol>
        <p className="mt-2 text-[12px] text-ink-2">
          <Rich parts={tRich(locale, "guide.footer")} boldClassName="font-semibold" />
        </p>
      </div>
    </details>
  );
}

function Step({ n, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink pt-0.5 font-mono text-[12px] font-semibold text-white">
        {n}
      </span>
      <span className="leading-normal">{children}</span>
    </li>
  );
}
