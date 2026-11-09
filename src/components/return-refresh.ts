export const RETURN_REFRESH_MIN_GAP_MS = 5000;

// Called on every visibilitychange: refreshes when the tab becomes visible, at most once per minimum gap.
export function returnRefresher(refresh: () => void, nowMs: () => number = Date.now): (visibility: DocumentVisibilityState) => void {
  let last: number | null = null;
  return (visibility) => {
    if (visibility !== "visible") return;
    const now = nowMs();
    if (last !== null && now - last < RETURN_REFRESH_MIN_GAP_MS) return;
    last = now;
    refresh();
  };
}
