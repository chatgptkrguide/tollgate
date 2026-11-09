// After Check scope marks a request, the new ticket is printed at the top of the tickets column. On a phone that column
// sits far above the message box, so the visitor would not see it: bring it into view and give its status line focus
// (the next Tab reaches its Send button). On a wide screen the column is usually already in view, so nothing moves.

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Viewport {
  width: number;
  height: number;
  topInset: number; // bottom of the sticky top bar: anything above it is covered
}

const TICKET_SELECTOR = "aside.ticket[data-change-order-id]";

// The first ticket in screen order (newest message first) that wasn't on screen before the check, or null.
export function firstNewTicketId(before: ReadonlySet<string>, shown: readonly string[]): string | null {
  return shown.find((id) => id !== "" && !before.has(id)) ?? null;
}

// Whole box visible below the top bar and inside the window. A ticket half under the bar or off to the side of the
// phone's sideways ticket row counts as not in view.
export function isInView(box: Box, viewport: Viewport): boolean {
  return box.top >= viewport.topInset && box.bottom <= viewport.height && box.left >= 0 && box.right <= viewport.width;
}

// The change order ids of the tickets on screen, in screen order.
export function ticketIdsOnScreen(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TICKET_SELECTOR), (el) => el.dataset.changeOrderId ?? "");
}

function show(ticket: HTMLElement) {
  // The list item, not the ticket: the ticket's print animation moves it while it plays.
  const frame = ticket.closest("li") ?? ticket;
  const bar = document.querySelector("[data-top-bar]")?.getBoundingClientRect().bottom ?? 0;
  const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight, topInset: Math.max(0, bar) };
  if (!isInView(frame.getBoundingClientRect(), viewport)) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // html's scroll-padding-top keeps it clear of the sticky top bar.
    frame.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start", inline: "nearest" });
  }
  ticket.querySelector<HTMLElement>("[role='status'][tabindex='-1']")?.focus({ preventScroll: true });
}

// Reveals the first ticket not in `before`. The refreshed page may land a moment after the action's answer, so it
// watches the page for up to `timeoutMs`. Returns a function that stops watching.
export function revealNewTicket(before: ReadonlySet<string>, timeoutMs = 3000): () => void {
  const tryReveal = (): boolean => {
    const id = firstNewTicketId(before, ticketIdsOnScreen());
    const ticket = id === null ? null : document.querySelector<HTMLElement>(`${TICKET_SELECTOR}[data-change-order-id="${CSS.escape(id)}"]`);
    if (!ticket) return false;
    show(ticket);
    return true;
  };
  if (tryReveal()) return () => {};

  const observer = new MutationObserver(() => {
    if (tryReveal()) stop();
  });
  const timer = setTimeout(stop, timeoutMs);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}
