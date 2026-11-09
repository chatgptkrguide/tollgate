import { statusLine, statusTone } from "@/components/order-text";
import type { ChangeOrderStatus } from "@/domain/types";
import type { WorkspaceData } from "@/domain/workspace";
import { formatDate, formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { t } from "@/i18n/t";

interface ScopePanelProps {
  data: WorkspaceData;
  locale: Locale;
}

// Shown but not billed, so struck through.
const notCounted = (status: ChangeOrderStatus) => status === "waived" || status === "cancelled";

// The ledger: what was agreed, every change order with its status, and the totals.
export function ScopePanel({ data, locale }: ScopePanelProps) {
  const { project, scopeItems, changeOrders, totals } = data;

  return (
    <section aria-labelledby="scope-title" className="rounded-[10px] border border-line bg-surface px-5 py-5">
      <h2 id="scope-title" className="font-display text-[20px] leading-tight font-bold">
        {t(locale, "scope.title")}
      </h2>
      <p className="mt-1 text-[14px] text-ink-2">{t(locale, "scope.version", { date: formatDate(locale, project.agreedOn) })}</p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {scopeItems.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-2.5 text-[15px]">
            <span>{item.title}</span>
            <span className="shrink-0 font-mono">{formatMoney(locale, item.amountCents)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-display text-[16px] font-bold">{t(locale, "scope.changeOrders")}</h3>
      {changeOrders.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink-2">{t(locale, "scope.none")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {changeOrders.map((o) => {
            const struck = notCounted(o.status) ? "text-ink-2 line-through" : "";
            return (
              <li key={o.id} className="py-2.5 text-[15px]">
                <div className="flex justify-between gap-4">
                  <span className={struck}>{o.title}</span>
                  <span className={`shrink-0 font-mono ${struck}`}>+{formatMoney(locale, o.amountCents)}</span>
                </div>
                <p className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold text-(--tone-ink)" data-tone={statusTone[o.status]}>
                  <span className="lamp scale-75" aria-hidden="true" />
                  {statusLine(locale, o)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-4 space-y-1 font-mono text-[14px]" data-testid="scope-totals">
        <div className="flex justify-between text-ink-2">
          <dt>{t(locale, "scope.agreed")}</dt>
          <dd>{formatMoney(locale, totals.agreedCents)}</dd>
        </div>
        <div className="flex justify-between text-ink-2">
          <dt>{t(locale, "scope.changeOrdersTotal")}</dt>
          <dd>+{formatMoney(locale, totals.changeOrdersCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-[17px] font-semibold">
          <dt>{t(locale, "scope.total")}</dt>
          <dd className="text-(--tone-ink)" data-tone={totals.hasUnpaid ? "stop" : "go"}>
            {formatMoney(locale, totals.totalCents)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
