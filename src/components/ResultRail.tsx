import { CountingAmount } from "@/components/CountingAmount";
import { LaunchDate, Road } from "@/components/DeliveryPanel";
import type { WorkspaceData } from "@/domain/workspace";
import { formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";

interface ResultRailProps {
  data: WorkspaceData;
  locale: Locale;
}

// What every payment or waiver changes, in one place: the totals with the unpaid chip, the launch date and the road.
// On a wide screen it heads the right column and sticks under the app bar while the tickets scroll under it; below
// 1024 px it is a one-line bar under the app bar (total, chip, launch). It is the same element at every width, so the
// server renders one structure and nothing jumps on load. Paying, waiving or cancelling refreshes the page, so the
// rail redraws from the server like the rest; MotionDirector plays its count and flip through data-fx-total and
// data-fx-launch.
export function ResultRail({ data, locale }: ResultRailProps) {
  const { totals, delivery } = data;
  const tone = totals.hasUnpaid ? "stop" : "go";

  return (
    <div
      data-result-rail=""
      className="sticky top-16 z-20 -mx-4 -mt-6 border-b border-line bg-surface px-4 py-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:-mt-4 lg:border-b-0 lg:bg-canvas lg:px-0 lg:pt-4 lg:pb-0"
    >
      <div className="lg:rounded-[10px] lg:border lg:border-line lg:bg-surface lg:px-4 lg:pt-3 lg:pb-3">
        {/* Total and chip on the left, the launch on the right; one line on a phone. On a wide screen a long chip wraps
            under the total rather than pushing the launch onto its own line. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 lg:flex-nowrap lg:items-start">
          <dl className="min-w-0">
            <div data-testid="header-total" data-fx-total="" data-tone={tone}>
              <dt className="font-display text-[13px] font-bold text-ink-2 max-lg:sr-only">{t(locale, "workspace.totalWithChanges")}</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:mt-1">
                <span className={`total-figure font-display text-[22px] leading-none font-extrabold tracking-[-0.02em] tabular-nums lg:pt-0.5 lg:text-[26px] ${totals.hasUnpaid ? "text-ink" : "text-go"}`}>
                  <CountingAmount cents={totals.totalCents} locale={locale} />
                </span>
                <span className="chip py-0.5! pr-2.5! pl-2! text-[13px]! whitespace-nowrap">
                  <span className="lamp" aria-hidden="true" />
                  {totals.unpaidCents > 0
                    ? t(locale, "workspace.notPaidYet", { amount: formatMoney(locale, totals.unpaidCents) })
                    : t(locale, "workspace.allPaid")}
                </span>
              </dd>
            </div>
          </dl>
          <LaunchDate plan={delivery} locale={locale} />
        </div>
        {/* Wide screens only: the agreed price where the road starts, and the road to the launch. */}
        <div className="mt-2 hidden items-start gap-4 lg:flex">
          <dl className="shrink-0">
            <dt className="font-display text-[12px] font-bold text-ink-2">{t(locale, "workspace.agreed")}</dt>
            <dd className="mt-0.5 font-display text-[16px] leading-tight font-bold text-ink-2 tabular-nums">{formatMoney(locale, totals.agreedCents)}</dd>
          </dl>
          <div className="min-w-0 flex-1">
            <Road plan={delivery} locale={locale} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
