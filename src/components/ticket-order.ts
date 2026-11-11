import type { ChangeOrderStatus } from "@/domain/types";

interface Ordered {
  order: { status: ChangeOrderStatus };
}

// What needs the freelancer first: drafts to send, then invoices the client hasn't paid, then the settled ones.
const RANK = { draft: 0, sent: 1, paid: 2, waived: 2, cancelled: 2 } as const satisfies Record<ChangeOrderStatus, number>;

// Tickets in the order to act on them. The sort is stable, so each group keeps the order it came in (newest message
// first in the workspace). Returns a new array.
export function actionFirst<T extends Ordered>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => RANK[a.order.status] - RANK[b.order.status]);
}
