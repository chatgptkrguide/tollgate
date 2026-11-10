"use client";

import { useId, useState, useTransition, type ChangeEvent } from "react";
import { setClientLocale } from "@/app/actions";
import { isLocale, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/locales";

export interface ClientLocaleSelectProps {
  projectId: string;
  clientLocale: Locale; // the project's client language, from the database
  label: string; // t(locale, "clientLocale.label")
  help: string; // t(locale, "clientLocale.help")
  saveFailed: string; // t(locale, "clientLocale.saveFailed")
  disabled: boolean; // the read-only preview (no copy exists, so there is nothing to save to)
}

// The language the client reads: new PayPal invoices for this project are written in it. A native <select>, each
// language written in itself. The server action saves it and refreshes the page; a refusal puts the old value back
// and says so. The screen language (LocaleSwitcher) is a separate choice.
export function ClientLocaleSelect({ projectId, clientLocale, label, help, saveFailed, disabled }: ClientLocaleSelectProps) {
  const id = useId();
  const helpId = useId();
  const [pending, startTransition] = useTransition();
  // Shows the new choice at once; the refreshed page brings the saved value.
  const [chosen, setChosen] = useState<Locale>(clientLocale);
  const [failed, setFailed] = useState(false);
  // A new value from the server (a reset puts the copy back on English) replaces the shown one.
  const [saved, setSaved] = useState<Locale>(clientLocale);
  if (saved !== clientLocale) {
    setSaved(clientLocale);
    setChosen(clientLocale);
  }

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (!isLocale(next)) return;
    setChosen(next);
    setFailed(false);
    startTransition(async () => {
      let ok = false;
      try {
        ok = (await setClientLocale(projectId, next)).ok;
      } catch {
        ok = false; // the request never reached the server or its answer was lost
      }
      if (!ok) {
        setChosen(clientLocale);
        setFailed(true);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="client-locale">
      <label htmlFor={id} className="pt-0.5 font-display text-[13px] font-bold text-ink-2">
        {label}
      </label>
      <select
        id={id}
        value={chosen}
        onChange={onChange}
        aria-describedby={helpId}
        aria-busy={pending || undefined}
        disabled={disabled}
        className="select select-quiet sm:text-[14px]"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
      <p id={helpId} className="basis-full text-[13px] leading-snug text-ink-2 sm:basis-auto">
        {help}
      </p>
      {failed && (
        <p role="alert" className="basis-full border-l-2 border-stop pl-3 text-[13px] font-semibold text-ink">
          {saveFailed}
        </p>
      )}
    </div>
  );
}
