import { formatShortDate } from "@/domain/dates";
import type { DeliveryPlan, DeliveryRow, DeliveryState } from "@/domain/delivery";

interface DeliveryPanelProps {
  plan: DeliveryPlan;
  className?: string;
}

interface DeliveryItemProps {
  row: DeliveryRow;
}

interface LockMarkProps {
  open: boolean;
}

const lineColor: Record<DeliveryState, string> = {
  locked: "border-mark",
  unlocked: "border-paid",
  included: "border-rule",
};

const textColor: Record<DeliveryState, string> = {
  locked: "text-mark",
  unlocked: "text-paid",
  included: "text-ink-soft",
};

function stateText(row: DeliveryRow): string {
  switch (row.state) {
    case "locked":
      return "Locked — starts when paid";
    case "unlocked":
      return row.unlockedAt ? `Unlocked ${formatShortDate(row.unlockedAt)}` : "Unlocked";
    case "included":
      return "Included at no charge";
  }
}

const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

// The product's promise on one card: extra work stays locked until its change order is paid, and paying it moves the
// launch. Everything comes from domain/delivery.ts; this only draws it.
export function DeliveryPanel({ plan, className = "" }: DeliveryPanelProps) {
  const agreed = formatShortDate(plan.agreedLaunch);
  const launch = formatShortDate(plan.launch);

  return (
    <section aria-labelledby="delivery-title" className={`rounded-md border border-rule bg-sheet px-6 py-6 ${className}`} data-testid="delivery-panel">
      <h2 id="delivery-title" className="font-serif text-[22px]">
        Delivery
      </h2>
      <p className="text-sm text-ink-soft">Extra work stays locked until it&apos;s paid.</p>

      <dl className="mt-4 flex items-baseline justify-between gap-4 border-y border-rule py-3 tabular-nums" data-testid="delivery-launch">
        <dt>Launch</dt>
        <dd className="text-[18px]">
          {plan.moved ? (
            <>
              <span className="sr-only">
                agreed {agreed}, now {launch}
              </span>
              <span aria-hidden="true">
                <span className="text-ink-soft line-through decoration-ink-soft/60">{agreed}</span>
                <span className="mx-1.5 text-ink-soft">→</span>
                <span className="font-semibold">{launch}</span>
              </span>
            </>
          ) : (
            <span className="font-semibold">{launch}</span>
          )}
        </dd>
      </dl>

      {plan.rows.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">No change orders yet, so the launch is as agreed.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {plan.rows.map((row) => (
            <DeliveryItem key={row.orderId} row={row} />
          ))}
        </ul>
      )}

      {plan.lockedDays > 0 && (
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          Paying the locked work moves the launch to <span className="whitespace-nowrap">{formatShortDate(plan.launchIfPaid)}.</span>
        </p>
      )}
    </section>
  );
}

function DeliveryItem({ row }: DeliveryItemProps) {
  const locked = row.state === "locked";
  return (
    <li className={`border-l-2 pl-3 ${lineColor[row.state]}`} data-change-order-id={row.orderId} data-delivery-state={row.state}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif leading-snug">{row.title}</span>
        {/* Locked days aren't in the launch yet, so they read as a quiet estimate rather than a "+". */}
        <span className={`shrink-0 text-sm tabular-nums ${locked ? "text-ink-soft" : ""}`}>
          {locked ? dayCount(row.days) : `+${dayCount(row.days)}`}
        </span>
      </div>
      <p className={`mt-0.5 flex items-center gap-1.5 text-sm font-semibold ${textColor[row.state]}`}>
        <LockMark open={!locked} />
        {stateText(row)}
      </p>
    </li>
  );
}

// Decorative: the words beside it carry the meaning.
function LockMark({ open }: LockMarkProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 14" width="12" height="14" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="6" width="10" height="7" rx="1.5" fill={open ? "none" : "currentColor"} />
      <path d={open ? "M3.5 6V4a2.5 2.5 0 0 1 4.9-.7" : "M3.5 6V4a2.5 2.5 0 0 1 5 0v2"} strokeLinecap="round" />
    </svg>
  );
}
