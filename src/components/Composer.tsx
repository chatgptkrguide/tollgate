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
  rate_limited: "This demo has checked as many messages as it may for now, so Claude wasn't called. Try again tomorrow.",
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
    const result = await reviewMessage(prev, formData);
    if (result.ok) setText("");
    return result;
  }, null);
  const off = pending || blockedReason !== null;

  // aria-disabled, not disabled: keyboard and screen reader users can still reach it and hear why.
  const stopIfOff = (event: MouseEvent<HTMLButtonElement>) => {
    if (off) event.preventDefault();
  };

  return (
    <form action={formAction} className="border-t border-rule bg-paper/50 px-5 py-6 sm:px-8">
      <label htmlFor="incoming" className="text-sm font-semibold">
        New message from {client}
      </label>
      <textarea
        id="incoming"
        name="message"
        aria-describedby={blockedReason ? "incoming-help check-blocked" : "incoming-help"}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste their latest email or chat message"
        className="mt-2 block w-full max-w-[62ch] resize-y rounded-md border border-ink-soft bg-sheet px-3 py-2 font-serif text-[17px] leading-relaxed placeholder:text-ink-soft"
      />
      <p id="incoming-help" className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
        Claude compares it with scope version 1. This is a public demo: the text goes to Claude and stays in your copy, so paste nothing private.
      </p>
      <div className="mt-3 flex max-w-[62ch] flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setText(SAMPLE_MESSAGE)}
          className="min-h-11 rounded-md border border-rule bg-sheet px-3 text-sm font-semibold text-ink-soft hover:border-ink-soft hover:text-ink"
        >
          Use a sample message
        </button>
        <button
          type="submit"
          aria-disabled={off}
          aria-describedby={blockedReason ? "check-blocked" : undefined}
          onClick={stopIfOff}
          className="min-h-11 rounded-md bg-ink px-4 text-sm font-semibold text-sheet not-aria-disabled:hover:bg-mark not-aria-disabled:active:bg-ink-soft aria-disabled:cursor-not-allowed aria-disabled:bg-rule aria-disabled:text-ink-soft"
        >
          {pending ? "Checking…" : "Check scope"}
        </button>
      </div>
      {blockedReason && (
        <p id="check-blocked" className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          {blockedReason}
        </p>
      )}
      <p role="status" className="mt-2 max-w-[62ch] text-sm leading-relaxed" data-testid="review-result">
        {pending ? "Claude is reading the message. This can take up to a minute." : resultText(state)}
      </p>
    </form>
  );
}
