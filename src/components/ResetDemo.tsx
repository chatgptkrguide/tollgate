"use client";

import { useActionState, useEffect, useId, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { resetDemo } from "@/app/actions";
import type { ResetActionResult } from "@/domain/action-result";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";

export interface ResetDemoProps {
  projectId: string;
  locale: Locale;
}

// Puts the visitor's copy back to the starting demo, after a confirmation: it deletes every change made to it.
// The server checks the id against the visitor cookie, and refuses while an invoice is still payable.
// Quiet text buttons: a demo utility, not part of the contract under review.
export function ResetDemo({ projectId, locale }: ResetDemoProps) {
  const [confirming, setConfirming] = useState(false);
  // An answer closes the confirmation, whatever it says.
  const [state, resetAction, pending] = useActionState(async (prev: ResetActionResult | null, formData: FormData) => {
    const result = await resetDemo(prev, formData);
    setConfirming(false);
    return result;
  }, null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmId = useId();
  const progress = pending ? t(locale, "reset.resetting") : state?.ok ? t(locale, "reset.done") : "";

  // "Reset demo" takes the confirm button's place once the answer is in, so focus goes back to it.
  useEffect(() => {
    if (state) resetRef.current?.focus();
  }, [state]);

  // Opening or closing the confirmation replaces the pressed button, so focus moves to the one in its place. The
  // "keep" button takes the first spot, so a double click lands on it rather than on the confirmation.
  const swap = (open: boolean, target: RefObject<HTMLButtonElement | null>) => {
    flushSync(() => setConfirming(open));
    target.current?.focus();
  };
  const QUIET =
    "min-h-11 rounded-[8px] px-2 pt-0.5 whitespace-nowrap sm:px-3 font-display text-[14px] font-bold text-ink-2 transition-colors not-aria-disabled:hover:bg-canvas not-aria-disabled:hover:text-ink not-aria-disabled:active:translate-y-px";

  return (
    <form action={resetAction} data-action="reset-demo" className="flex flex-col items-end gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      {confirming ? (
        <div className="-mr-3 flex flex-wrap justify-end gap-1">
          <button
            key="keep"
            ref={keepRef}
            type="button"
            onClick={pending ? undefined : () => swap(false, resetRef)}
            aria-disabled={pending || undefined}
            aria-describedby={confirmId}
            className={QUIET}
          >
            {t(locale, "reset.keep")}
          </button>
          {/* aria-disabled while resetting, not disabled: a disabled button drops the focus it holds. */}
          <button
            key="confirm"
            type="submit"
            aria-disabled={pending || undefined}
            aria-describedby={confirmId}
            onClick={(event) => {
              if (pending) event.preventDefault(); // no second reset while the first is running
            }}
            className={`${QUIET} text-stop-ink aria-disabled:cursor-wait`}
          >
            {pending ? t(locale, "reset.resetting") : t(locale, "reset.confirm")}
          </button>
        </div>
      ) : (
        <button key="reset" ref={resetRef} type="button" onClick={() => swap(true, keepRef)} className={`-mr-2 sm:-mr-3 ${QUIET}`}>
          {t(locale, "reset.reset")}
        </button>
      )}
      {confirming && (
        <p id={confirmId} className="max-w-xs text-right text-[13px] leading-relaxed">
          {t(locale, "reset.confirmHelp")}
        </p>
      )}
      {/* Always present, so screen readers announce each change of its text. */}
      <p role="status" className="sr-only">
        {progress}
      </p>
      {state && !state.ok && (
        <p role="alert" className="max-w-xs border-l-2 border-stop pl-3 text-[13px] font-semibold text-ink">
          {t(locale, `resetErrors.${state.error}`)}
        </p>
      )}
    </form>
  );
}
