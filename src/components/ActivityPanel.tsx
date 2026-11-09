import type { ActivityActor, ActivityEvent } from "@/domain/activity";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { t, tCount } from "@/i18n/t";

interface ActivityPanelProps {
  activity: readonly ActivityEvent[]; // oldest first
  locale: Locale;
}

interface ActivityItemProps {
  event: ActivityEvent;
  locale: Locale;
}

const actorText: Record<ActivityActor, string> = {
  app: "Tollgate",
  claude: "Claude",
  paypal: "PayPal",
};

const SHOWN = 6; // the rest fold under "earlier steps"

// UTC like every other date on the page, so the server and the browser print the same.
function stepTime(locale: Locale, iso: string): string {
  const at = formatDateTime(locale, iso);
  return at && `${at} UTC`;
}

// What happened, newest first. It only explains: nothing here can start a PayPal call.
export function ActivityPanel({ activity, locale }: ActivityPanelProps) {
  const newest = [...activity].reverse();
  const recent = newest.slice(0, SHOWN);
  const earlier = newest.slice(SHOWN);

  return (
    <section aria-labelledby="activity-title" className="rounded-[10px] border border-line bg-surface px-5 py-5" data-testid="activity-panel">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="activity-title" className="font-display text-[20px] leading-tight font-bold">
          {t(locale, "activity.title")}
        </h2>
        {activity.length > 0 && <p className="font-mono text-[13px] text-ink-2">{tCount(locale, "activity.steps", activity.length)}</p>}
      </div>
      <p className="mt-1 text-[14px] text-ink-2">{t(locale, "activity.lead")}</p>
      {activity.length === 0 ? (
        <p className="mt-4 border-t border-line pt-3 text-[14px] leading-relaxed text-ink-2">
          {t(locale, "activity.empty")}
        </p>
      ) : (
        <>
          <ol className="mt-4 border-t border-line">
            {recent.map((event) => (
              <ActivityItem key={event.id} event={event} locale={locale} />
            ))}
          </ol>
          {earlier.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 border-t border-line font-display text-[14px] font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12" className="transition-transform group-open:rotate-90 motion-reduce:transition-none">
                  <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {tCount(locale, "activity.earlier", earlier.length)}
              </summary>
              <ol>
                {earlier.map((event) => (
                  <ActivityItem key={event.id} event={event} locale={locale} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function ActivityItem({ event, locale }: ActivityItemProps) {
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 last:border-b-0" data-kind={event.kind} data-fx-activity={event.id}>
      <span className="pt-0.5 font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">{actorText[event.actor]}</span>
      <span className="text-[14px] leading-relaxed">
        {event.summary}
        <span className="mt-0.5 block font-mono text-[12px] text-ink-2">{stepTime(locale, event.at)}</span>
      </span>
    </li>
  );
}
