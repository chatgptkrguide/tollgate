export const AWAIT_PAYMENT_EVERY_MS = 5000;
export const AWAIT_PAYMENT_FOR_MS = 90_000;

export interface PollClock {
  every(ms: number, tick: () => void): () => void; // starts a repeating timer; the function returned stops it
  nowMs(): number;
}

const browserClock: PollClock = {
  every(ms, tick) {
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  },
  nowMs: () => Date.now(),
};

// After a simulated sandbox payment: re-reads the page every five seconds, so the ticket turns Paid once PayPal's webhook
// lands, without a reload. Stops for good after 90 seconds, or at the first tick the page is hidden (coming back to the
// tab refreshes it anyway, RefreshOnReturn). Returns the stop function, which the caller runs once the ticket is paid.
export function awaitPaymentPoller(refresh: () => void, isHidden: () => boolean, clock: PollClock = browserClock): () => void {
  const started = clock.nowMs();
  let stopped = false;
  const stop = clock.every(AWAIT_PAYMENT_EVERY_MS, () => {
    if (stopped) return;
    if (isHidden() || clock.nowMs() - started > AWAIT_PAYMENT_FOR_MS) {
      stopped = true;
      stop();
      return;
    }
    refresh();
  });
  return () => {
    stopped = true;
    stop();
  };
}
