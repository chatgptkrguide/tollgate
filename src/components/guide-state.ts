// The demo guide's Show details / Hide details choice, kept in a cookie so the server renders the guide the way the
// visitor left it (no jump after the page loads). It starts folded: the one-line steps are enough to begin.

export const GUIDE_COOKIE = "tg_guide";

const OPEN = "open";
const CLOSED = "closed";
const ONE_YEAR_S = 365 * 24 * 60 * 60;

// True only when the visitor opened the guide last time; a missing or unknown value means folded.
export function isGuideOpen(value: string | undefined): boolean {
  return value === OPEN;
}

// The document.cookie string that remembers the choice. Not HttpOnly on purpose: it holds no secret, only a fold.
export function guideCookie(open: boolean): string {
  return `${GUIDE_COOKIE}=${open ? OPEN : CLOSED}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax`;
}

// The controls the guide's links jump to. The Send button is the first one on screen: tickets are listed newest first,
// and only a draft has one.
export const COMPOSER_SELECTOR = "#incoming";
export const SEND_SELECTOR = "aside.ticket[data-change-order-id] form[data-action='send'] button";
