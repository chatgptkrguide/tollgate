// Caps on PayPal sends. Every demo copy shares one PayPal sandbox app, so a visitor looping "send, reset, send" could
// get that app rate limited (429) for everyone, in the middle of a demo too. The server-wide cap holds however many
// copies or cookies are used (P2-S1); the per-copy cap keeps one visitor from using up the server's day for every other
// visitor (P2-S5). The count lives in the paypal_sends table (server/db/paypal-sends.ts), which resets and cleanups
// never touch (P2-S1b), so resetting a copy gives it no new allowance.

export interface SendLimit {
  windowMs: number;
  max: number; // sends allowed within the window
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const SEND_LIMITS = [
  { windowMs: MINUTE_MS, max: 10 },
  { windowMs: DAY_MS, max: 200 },
] as const satisfies readonly SendLimit[];

// A full walkthrough sends three to five invoices (send, cancel, quote again, send); 20 leaves room to try it several
// times, and it takes ten copies to use up the server's 200.
export const SEND_LIMITS_PER_COPY = [{ windowMs: DAY_MS, max: 20 }] as const satisfies readonly SendLimit[];
