"use client";

import { useActionState, useState, type MouseEvent } from "react";
import { reviewMessage } from "@/app/actions";
import type { ActionError, ReviewActionError, ReviewActionResult } from "@/domain/action-result";
import { MAX_REVIEW_MESSAGE_CHARS } from "@/domain/review-limit";

export interface ComposerProps {
  client: string;
  blockedReason: string | null; // why checking is off (no Claude key on this server); null when it works
}

const SAMPLE_MESSAGE =
  "The menu looks great! Two things before launch: could you also add a blog so we can post seasonal drinks, and can the contact form button be green instead of blue? Thanks!";

const errorText: Record<ActionError | ReviewActionError, string> = {
  invalid_input: "Paste a message first.",
  not_found: "Your demo copy couldn't be found. Reload the page.",
  invalid_state: "This couldn't be checked just now. Try again.",
  server_error: "This couldn't be saved just now. Nothing changed; try again.",
  too_long: `That's longer than this demo checks (${MAX_REVIEW_MESSAGE_CHARS.toLocaleString("en-US")} characters). Paste the part with the requests.`,
  not_configured: "Claude isn't set up on this server, so the message wasn't checked.",
  rate_limited: "This demo has checked as many messages as it may for now, so Claude wasn't called. Try again later.",
  claude_unavailable: "Claude couldn't review this just now. Nothing was saved, so you can try again.",
  claude_refused: "Claude declined to review this message. Nothing was saved.",
};

function resultText(state: ReviewActionResult | null): string {
  if (!state) return "";
  if (!state.ok) return errorText[state.error];
  if (state.marked === 0) return "Claude found nothing outside the agreed scope.";
  return `Claude marked ${state.marked} ${state.marked === 1 ? "request" : "requests"} in the message above. Review ${state.marked === 1 ? "it" : "them"} before anything is sent.`;
}

// The browser sends only the text. The textarea is controlled because React clears a form after its action, and a
// message that failed to check should stay there to try again.
export function Composer({ client, blockedReason }: ComposerProps) {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(async (prev: ReviewActionResult | null, formData: FormData) => {
    let result: ReviewActionResult;
    try {
      result = await reviewMessage(prev, formData);
    } catch {
      // The request never reached the server or its answer was lost: say so instead of breaking the page.
      return { ok: false, error: "server_error" } satisfies ReviewActionResult;
    }
    // Text typed while Claude was reading is the visitor's next message; keep it.
    const sent = formData.get("message");
    if (result.ok) setText((current) => (current === sent ? "" : current));
    return result;
  }, null);
  // Pressing Check scope while checking is off says why in the result line, so the press is never a dead click.
  const [blockedPressed, setBlockedPressed] = useState(false);
  const off = pending || blockedReason !== null;
  const showBlocked = blockedReason !== null && blockedPressed && !pending;

  // aria-disabled, not disabled: keyboard and screen reader users can still reach it and hear why.
  const stopIfOff = (event: MouseEvent<HTMLButtonElement>) => {
    if (!off) return;
    event.preventDefault();
    if (blockedReason !== null) setBlockedPressed(true);
  };

  return (
    <form action={formAction} className="border-t border-line bg-surface px-5 pt-4 pb-5 sm:px-6">
      <label htmlFor="incoming" className="font-display text-[14px] font-bold">
        New message from {client}
      </label>
      {/* While Claude reads, a thin line sweeps the message (hidden under reduced motion; the result line says it in words). */}
      <div className="relative mt-2">
        <textarea
          id="incoming"
          name="message"
          aria-describedby={blockedReason ? "incoming-help check-blocked" : "incoming-help"}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste their latest email or chat message"
          className="block w-full resize-y rounded-[8px] border border-field bg-surface px-3 py-2.5 text-[16px] leading-relaxed placeholder:text-ink-2 focus-visible:border-ink"
        />
        {pending && <span aria-hidden="true" className="scan-line" />}
      </div>
      <p id="incoming-help" className="mt-2 text-[13px] leading-relaxed text-ink-2">
        Claude compares it with scope version 1. This is a public demo: the text goes to Claude and stays in your copy, so paste nothing private.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setText(SAMPLE_MESSAGE)} className="btn btn-secondary">
          Use a sample message
        </button>
        <button
          type="submit"
          aria-disabled={off}
          aria-describedby={blockedReason ? "check-blocked" : undefined}
          onClick={stopIfOff}
          className={`btn btn-primary ${pending ? "aria-disabled:cursor-wait" : "aria-disabled:cursor-not-allowed"}`}
        >
          {pending ? "Checking…" : "Check scope"}
          {pending && <span aria-hidden="true" className="btn-progress" />}
        </button>
      </div>
      {/* Once pressed, the reason moves into the result line below; this copy stays for aria-describedby. */}
      {blockedReason && (
        <p id="check-blocked" className={showBlocked ? "sr-only" : "mt-2 text-[13px] leading-relaxed text-ink-2"}>
          {blockedReason}
        </p>
      )}
      <p role="status" className="mt-2 text-[14px] leading-relaxed" data-testid="review-result">
        {pending ? "Claude is reading the message. This can take up to a minute." : showBlocked ? blockedReason : resultText(state)}
      </p>
    </form>
  );
}
