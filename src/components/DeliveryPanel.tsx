import type { CSSProperties } from "react";
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

interface RoadProps {
  plan: DeliveryPlan;
  rows: readonly DeliveryRow[];
}

const textColor: Record<DeliveryState, string> = {
  locked: "text-stop-ink",
  unlocked: "text-go",
  included: "text-ink-2",
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

// Work already in the launch comes first, then the gate, then the locked work behind it.
const inLaunchFirst = (rows: readonly DeliveryRow[]) => [...rows.filter((r) => r.state !== "locked"), ...rows.filter((r) => r.state === "locked")];

// The product's promise as a road: from the agreed launch, each change order is a stretch of days. Locked stretches
// carry barrier stripes until paid; paid ones are solid GO, included ones grey. The launch date sits at the gate
// between them. Everything comes from domain/delivery.ts; this only draws it, and each row says its state in words.
export function DeliveryPanel({ plan, className = "" }: DeliveryPanelProps) {
  const agreed = formatShortDate(plan.agreedLaunch);
  const launch = formatShortDate(plan.launch);
  const rows = inLaunchFirst(plan.rows);

  return (
    <section aria-labelledby="delivery-title" className={`rounded-[10px] border border-line bg-surface px-5 py-5 ${className}`} data-testid="delivery-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="delivery-title" className="font-display text-[20px] leading-tight font-bold">
            Delivery
          </h2>
          <p className="mt-1 text-[14px] text-ink-2">Extra work stays locked until it&apos;s paid.</p>
        </div>
        <dl className="shrink-0 text-right" data-testid="delivery-launch" data-fx-launch="">
          <dt className="font-display text-[13px] font-bold text-ink-2">Launch</dt>
          <dd className="font-mono text-[20px] leading-tight font-semibold">
            {plan.moved ? (
              <>
                <span className="sr-only">
                  agreed {agreed}, now {launch}
                </span>
                <span aria-hidden="true">
                  <s className="launch-was text-[15px] font-normal text-ink-2 decoration-ink-2">{agreed}</s>
                  <span className="mx-1.5 text-[15px] font-normal text-ink-2">→</span>
                  <span className="launch-now">{launch}</span>
                </span>
              </>
            ) : (
              <span className="launch-now">{launch}</span>
            )}
          </dd>
        </dl>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 border-t border-line pt-3 text-[14px] leading-relaxed text-ink-2">No change orders yet, so the launch is as agreed.</p>
      ) : (
        <>
          <Road plan={plan} rows={rows} />
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {rows.map((row) => (
              <DeliveryItem key={row.orderId} row={row} />
            ))}
          </ul>
        </>
      )}

      {plan.lockedDays > 0 && (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          Paying the locked work moves the launch to <span className="whitespace-nowrap">{formatShortDate(plan.launchIfPaid)}.</span>
        </p>
      )}
    </section>
  );
}

// Decorative: the rows below say the same in words.
function Road({ plan, rows }: RoadProps) {
  const weight = (row: DeliveryRow) => Math.max(row.days, 1);
  const total = rows.reduce((sum, row) => sum + weight(row), 0);
  const inLaunch = rows.filter((row) => row.state !== "locked").reduce((sum, row) => sum + weight(row), 0);
  const gateAt = Math.round((inLaunch / total) * 100);
  const hasLocked = plan.lockedDays > 0 || rows.some((row) => row.state === "locked");
  // The launch label sits over the gate, leaning away from whichever end is nearer so it never leaves the road.
  const gateLabel: CSSProperties = gateAt <= 50 ? { left: `${gateAt}%` } : { right: `${100 - gateAt}%` };

  return (
    <div aria-hidden="true" className="mt-5 font-mono text-[12px] text-ink-2">
      <div className="relative h-5">
        <span className="absolute bottom-0 whitespace-nowrap text-ink" style={gateLabel}>
          <span className="font-semibold">{formatShortDate(plan.launch)}</span> launch
        </span>
      </div>
      <div className="relative mt-1 flex items-center gap-[3px]">
        <span className="h-6 w-[3px] shrink-0 rounded-sm bg-ink" />
        {rows.map((row) => (
          <span key={row.orderId} className="road-seg" data-state={row.state} data-fx-order={row.orderId} style={{ flexGrow: weight(row), flexBasis: 0 }}>
            <span className="hatch" />
          </span>
        ))}
        {/* The gate: a post with its lamp, between the work already in the launch and the work behind it. */}
        <span className="absolute -top-1 h-8 w-[3px] -translate-x-1/2 rounded-sm bg-ink" style={{ left: `calc(${gateAt}% + 1px)` }}>
          <span className={`absolute -top-1.5 -left-[3px] h-[9px] w-[9px] rounded-full ${hasLocked ? "bg-stop" : "bg-go"}`} />
        </span>
      </div>
      <div className="mt-2 flex justify-between gap-4">
        <span>{formatShortDate(plan.agreedLaunch)} agreed</span>
        {hasLocked && <span>{formatShortDate(plan.launchIfPaid)} if paid</span>}
      </div>
    </div>
  );
}

function DeliveryItem({ row }: DeliveryItemProps) {
  const locked = row.state === "locked";
  return (
    <li className="flex gap-3 py-3" data-change-order-id={row.orderId} data-delivery-state={row.state}>
      <span className="road-seg swatch mt-1.5" data-state={row.state} data-fx-order={row.orderId}>
        <span className="hatch" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-[15px] leading-snug font-semibold">{row.title}</span>
          {/* Locked days aren't in the launch yet, so they read as a quiet estimate rather than a "+". */}
          <span className={`shrink-0 font-mono text-[13px] ${locked ? "text-ink-2" : "text-ink"}`}>
            {locked ? dayCount(row.days) : `+${dayCount(row.days)}`}
          </span>
        </div>
        <p className={`mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold ${textColor[row.state]}`}>
          <LockMark open={!locked} />
          {stateText(row)}
        </p>
      </div>
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
