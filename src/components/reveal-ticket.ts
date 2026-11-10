// After Check scope marks a request, the new ticket is printed at the top of the tickets column. On a phone that column
// sits far above the message box, so the visitor would not see it: bring it into view and move focus to it (the next
// Tab reaches its Send button). On a wide screen the column is usually already in view, so nothing moves, and the
// Composer's result line is the only thing a screen reader hears. Nothing moves while the visitor is typing either:
// the Composer keeps text typed during a check, and scrolling or taking focus would pull them out of their sentence.

export interface Box {
  top: number;
  left: number;
  right: number;
}

export interface Viewport {
  width: number;
  height: number;
  topInset: number; // bottom of the sticky top bar: anything above it is covered
}

// The ticket's number row and status line: what has to show for the ticket to count as seen.
export const TICKET_HEAD_PX = 72;

const TICKET_SELECTOR = "aside.ticket[data-change-order-id]";

// A ticket that wasn't on screen before the check (one without an id never counts).
export function isNewTicket(before: ReadonlySet<string>, id: string | undefined): boolean {
  return id !== undefined && id !== "" && !before.has(id);
}

// The top of the ticket and its status line show below the top bar, and it isn't pushed off to the side of the phone's
// sideways ticket row. A ticket taller than the window still counts once its head shows.
export function isInView(box: Box, viewport: Viewport): boolean {
  return (
    box.top >= viewport.topInset && box.top + TICKET_HEAD_PX <= viewport.height && box.left >= 0 && box.right <= viewport.width
  );
}

export interface Focused {
  tagName: string;
  type?: string; // an input's type
  isContentEditable?: boolean;
}

// Inputs that take a click, not text.
const NOT_TEXT_INPUTS = new Set(["button", "checkbox", "radio", "submit", "reset", "range", "color", "file", "image", "hidden"]);

// True while the visitor is typing in a text field: focus and scroll must stay where they are.
export function isTyping(active: Focused | null): boolean {
  if (!active) return false;
  if (active.isContentEditable || active.tagName === "TEXTAREA") return true;
  return active.tagName === "INPUT" && !NOT_TEXT_INPUTS.has(active.type ?? "text");
}

// The change order ids of the tickets on screen, in screen order.
export function ticketIdsOnScreen(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TICKET_SELECTOR), (el) => el.dataset.changeOrderId ?? "");
}

// Reveals the first ticket not in `before`. Call it once the action's answer has rendered: the refreshed page commits
// with it (see Composer), so the ticket is already there.
export function revealNewTicket(before: ReadonlySet<string>): void {
  if (isTyping(document.activeElement)) return;
  // The first new one in screen order (newest message first).
  const ticket = Array.from(document.querySelectorAll<HTMLElement>(TICKET_SELECTOR)).find((el) =>
    isNewTicket(before, el.dataset.changeOrderId),
  );
  if (!ticket) return;

  // The list item, not the ticket: the ticket's print animation moves it while it plays.
  const frame = ticket.closest("li") ?? ticket;
  const bar = document.querySelector("[data-top-bar]")?.getBoundingClientRect().bottom ?? 0;
  const { clientWidth, clientHeight } = document.documentElement;
  if (isInView(frame.getBoundingClientRect(), { width: clientWidth, height: clientHeight, topInset: Math.max(0, bar) })) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // html's scroll-padding-top keeps it clear of the sticky top bar.
  frame.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start", inline: "nearest" });
  // The ticket itself (tabIndex -1, named by its title), not its status line: a focused live region would be heard
  // on top of the Composer's result line.
  ticket.focus({ preventScroll: true });
}
