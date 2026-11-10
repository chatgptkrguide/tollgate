"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { COMPOSER_SELECTOR, guideCookie, SEND_SELECTOR } from "@/components/guide-state";
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
  readOnly: boolean; // a view-only preview (a new copy was refused): nothing can be checked, sent or saved
  defaultOpen: boolean; // the visitor's last Show details / Hide details choice (guide-state.ts)
  locale: Locale;
}

interface QuickStep {
  id: string;
  body: ReactNode;
}

interface StepProps {
  n: number;
  children: ReactNode;
}

// Links underline in ink: STOP red is kept for unpaid and locked work only. The padding, taken back by the negative
// margin, widens the hit area of these small inline links without moving their text.
const LINK = "-mx-1 px-1 py-1.5 font-semibold underline decoration-ink-2 decoration-2 underline-offset-4 hover:decoration-ink";

// Scrolls the control a guide link names into the middle of the screen and focuses it, so the next key press or tap
// acts on it. Without the control (no draft left to send) the link's own href takes over.
function jumpTo(selector: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    const control = document.querySelector<HTMLElement>(selector);
    if (!control) return;
    event.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    control.scrollIntoView({ block: "center", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
    control.focus({ preventScroll: true });
  };
}

// What a first-time visitor (usually a judge) needs before touching anything, in one line under the app bar: the
// three steps, with the controls they name as links that jump there. Show details opens the full text (what Tollgate
// does, each step, and that the copy is theirs); the choice is remembered in a cookie, so a reload or a refresh after
// an action draws the guide the way the visitor left it. In a view-only preview the guide says so first and its steps
// become ones that can be followed without saving anything.
export function DemoGuide({ client, reviewBlockedReason, target, readOnly, defaultOpen, locale }: DemoGuideProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    document.cookie = guideCookie(next);
  };

  const link = (href: string, selector?: string) =>
    function GuideLink(text: string) {
      return (
        <a href={href} onClick={selector ? jumpTo(selector) : undefined} className={LINK}>
          {text}
        </a>
      );
    };
  const toTarget = target ? link(target.href) : undefined;
  const toComposer = link(COMPOSER_SELECTOR, COMPOSER_SELECTOR);
  const toSend = target ? link(target.href, SEND_SELECTOR) : undefined;

  const quick: readonly QuickStep[] = readOnly
    ? [
        { id: "read", body: <Rich parts={tRich(locale, "guide.quick1ReadOnly")} link={toTarget} /> },
        { id: "see", body: t(locale, "guide.quick2ReadOnly") },
        { id: "reload", body: t(locale, "guide.quick3ReadOnly") },
      ]
    : [
        {
          id: "check",
          body:
            reviewBlockedReason === null ? (
              <Rich parts={tRich(locale, "guide.quick1Live")} link={toComposer} />
            ) : target ? (
              <Rich parts={tRich(locale, "guide.quick1Target")} link={toTarget} />
            ) : (
              t(locale, "guide.quick1NoTarget")
            ),
        },
        { id: "price", body: t(locale, "guide.quick2") },
        { id: "send", body: <Rich parts={tRich(locale, "guide.quick3")} link={toSend} /> },
      ];

  return (
    <section aria-labelledby="demo-guide-title" className="border-b border-line bg-canvas" data-testid="demo-guide" data-open={open}>
      {readOnly && (
        <p role="status" data-testid="preview-notice" className="border-b border-line bg-stop-wash">
          <span className="mx-auto block max-w-[1280px] px-4 py-2.5 text-[14px] leading-relaxed sm:px-8">
            <Rich parts={tRich(locale, "guide.previewNotice")} boldClassName="font-bold" />
          </span>
        </p>
      )}
      {/* Title and toggle share the first row; the steps sit between them on a wide screen and under them elsewhere. */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 text-[14px] leading-snug sm:px-8 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span id="demo-guide-title" className="col-start-1 row-start-1 font-display font-bold">
          {t(locale, "guide.summaryTitle")}
        </span>
        {!open && (
          <ol
            aria-label={t(locale, "guide.stepsLabel")}
            data-testid="guide-quick"
            className="col-span-2 row-start-2 flex flex-col pb-2.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-0.5 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:py-2.5"
          >
            {quick.map((step, i) => (
              <li key={step.id} className="flex items-baseline gap-1.5">
                {i > 0 && (
                  <span aria-hidden="true" className="hidden text-ink-2 sm:inline">
                    →
                  </span>
                )}
                <span aria-hidden="true" className="font-mono text-[13px] font-semibold text-ink-2">
                  {i + 1}
                </span>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="demo-guide-details"
          onClick={toggle}
          className="col-start-2 row-start-1 -mr-2 min-h-11 cursor-pointer justify-self-end px-2 font-display font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink-2 lg:col-start-3"
        >
          {open ? t(locale, "guide.hide") : t(locale, "guide.show")}
        </button>
      </div>
      <div id="demo-guide-details" hidden={!open} className="mx-auto max-w-[1280px] px-4 pb-3 sm:px-8">
        <p className="text-[14px] text-ink-2">{t(locale, "guide.summaryText")}</p>
        <ol data-testid="guide-steps" className="mt-2 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-3">
          <Step n={1}>
            {readOnly ? (
              <Rich parts={tRich(locale, "guide.step1ReadOnly", { client })} />
            ) : reviewBlockedReason === null ? (
              <Rich parts={tRich(locale, "guide.step1Live", { client })} link={toComposer} />
            ) : target ? (
              <Rich parts={tRich(locale, "guide.step1Target", { author: target.author, sentOn: target.sentOn })} link={toTarget} />
            ) : (
              <Rich parts={tRich(locale, "guide.step1NoTarget", { client })} />
            )}
          </Step>
          <Step n={2}>{t(locale, "guide.step2")}</Step>
          <Step n={3}>{readOnly ? t(locale, "guide.step3ReadOnly") : <Rich parts={tRich(locale, "guide.step3")} link={toSend} />}</Step>
        </ol>
        <p className="mt-2 text-[13px] text-ink-2">
          <Rich parts={tRich(locale, readOnly ? "guide.footerReadOnly" : "guide.footer")} boldClassName="font-semibold" />
        </p>
      </div>
    </section>
  );
}

function Step({ n, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink pt-0.5 font-mono text-[13px] font-semibold text-white">
        {n}
      </span>
      <span className="leading-normal">{children}</span>
    </li>
  );
}
