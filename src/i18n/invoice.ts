import { PRICE_STEP_CENTS } from "@/domain/money";
import { formatMoney, formatNumber } from "./format";
import type { Locale } from "./locales";
import { t } from "./t";

// The invoice lines PayPal shows the client, in the project's client language. Only words change: the amount, the
// currency (USD), the item name (the change order's title) and the invoice number are the same in every language.

export interface InvoiceTextInput {
  projectTitle: string; // data: written as the freelancer typed it, never translated
  hours: number;
  hourlyRateCents: number;
  roundedUp: boolean; // the price was rounded up to the next PRICE_STEP_CENTS
}

export interface InvoiceTexts {
  description: string; // the item line, e.g. "Estimated 13 h at $50/h"
  note: string; // the note to the client
}

export function invoiceTexts(locale: Locale, input: InvoiceTextInput): InvoiceTexts {
  const params = {
    hours: formatNumber(locale, input.hours),
    rate: formatMoney(locale, input.hourlyRateCents),
    step: formatMoney(locale, PRICE_STEP_CENTS),
  };
  return {
    description: input.roundedUp ? t(locale, "invoice.descriptionRounded", params) : t(locale, "invoice.description", params),
    note: t(locale, "invoice.note", { project: input.projectTitle }),
  };
}
