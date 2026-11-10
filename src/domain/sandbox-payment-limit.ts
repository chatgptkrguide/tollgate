import type { SendLimit } from "./send-limit";

// Caps on "Simulate the client's payment (sandbox)", which records a payment on the copy's invoice through PayPal's API.
// Every copy shares one PayPal sandbox app, like sends do, so the server-wide cap holds however many cookies are used and
// the per-copy cap keeps one visitor from using up the day. A walkthrough needs one or two. The count lives in the
// sandbox_payments table (server/db/sandbox-payments.ts), which resets and cleanups never touch.

const DAY_MS = 24 * 60 * 60 * 1000;

export const SANDBOX_PAYMENT_LIMITS_PER_COPY = [{ windowMs: DAY_MS, max: 5 }] as const satisfies readonly SendLimit[];

export const SANDBOX_PAYMENT_LIMITS_PER_SERVER = [{ windowMs: DAY_MS, max: 100 }] as const satisfies readonly SendLimit[];
