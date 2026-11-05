import type { ActivityActor, ActivityEvent } from "@/domain/activity";

interface ActivityPanelProps {
  activity: readonly ActivityEvent[]; // oldest first
}

interface ActivityItemProps {
  event: ActivityEvent;
}

const actorText: Record<ActivityActor, string> = {
  app: "Tollgate",
  claude: "Claude",
  paypal: "PayPal",
};

const SHOWN = 6; // the rest fold under "earlier steps"

// UTC like every other date on the page, so the server and the browser print the same.
const time = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
function stepTime(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${time.format(at)} UTC`;
}

// What happened, newest first. It only explains: nothing here can start a PayPal call.
export function ActivityPanel({ activity }: ActivityPanelProps) {
  const newest = [...activity].reverse();
  const recent = newest.slice(0, SHOWN);
  const earlier = newest.slice(SHOWN);

  return (
    <section aria-labelledby="activity-title" className="rounded-[10px] border border-line bg-surface px-5 py-5" data-testid="activity-panel">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="activity-title" className="font-display text-[20px] leading-tight font-bold">
          Activity
        </h2>
        {activity.length > 0 && (
          <p className="font-mono text-[12px] text-ink-2">
            {activity.length} {activity.length === 1 ? "step" : "steps"}
          </p>
        )}
      </div>
      <p className="mt-1 text-[14px] text-ink-2">Claude proposes. Nothing reaches PayPal until you press a button.</p>
      {activity.length === 0 ? (
        <p className="mt-4 border-t border-line pt-3 text-[14px] leading-relaxed text-ink-2">
          Nothing yet. Check a message or send a change order, and each step shows up here.
        </p>
      ) : (
        <>
          <ol className="mt-4 border-t border-line">
            {recent.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </ol>
          {earlier.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 border-t border-line font-display text-[14px] font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" className="transition-transform group-open:rotate-90 motion-reduce:transition-none">
                  <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {earlier.length} earlier {earlier.length === 1 ? "step" : "steps"}
              </summary>
              <ol>
                {earlier.map((event) => (
                  <ActivityItem key={event.id} event={event} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function ActivityItem({ event }: ActivityItemProps) {
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0" data-kind={event.kind} data-fx-activity={event.id}>
      <span className="pt-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">{actorText[event.actor]}</span>
      <span className="text-[14px] leading-relaxed">
        {event.summary}
        <span className="mt-0.5 block font-mono text-[12px] text-ink-2">{stepTime(event.at)}</span>
      </span>
    </li>
  );
}
