import type { SendLimit } from "./send-limit";

// Caps on Claude reviews. Each review costs real money and every copy shares one key, so the server-wide cap is what
// bounds the bill however many cookies are used; the per-copy cap keeps one visitor from using up the day for the rest.
// The count lives in the claude_calls table (server/db/claude-calls.ts), which resets and cleanups never touch.

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const REVIEW_LIMITS_PER_COPY = [{ windowMs: DAY_MS, max: 10 }] as const satisfies readonly SendLimit[];

export const REVIEW_LIMITS_PER_SERVER = [
  { windowMs: MINUTE_MS, max: 10 },
  { windowMs: DAY_MS, max: 100 },
] as const satisfies readonly SendLimit[];

export const MAX_REVIEW_MESSAGE_CHARS = 4000;
// More marks than this on one message is noise, not review.
export const MAX_FINDINGS_PER_MESSAGE = 8;
