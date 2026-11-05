"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ChangeEvent } from "react";
import { setLocale } from "./actions";
import { isLocale, LOCALE_NAMES, LOCALES, type Locale } from "./locales";

export interface LocaleSwitcherProps {
  locale: Locale; // the request's screen language, from getLocale()
  label: string; // t(locale, "localeSwitcher.label"): "Language", with the English word kept in other languages
  className?: string;
}

// A native <select>, so it works with every keyboard and screen reader. Each language is written in itself and
// marked with its own lang, so a screen reader pronounces it right. The choice is saved in the tg_locale cookie, then
// the server renders the page again in that language.
export function LocaleSwitcher({ locale, label, className = "" }: LocaleSwitcherProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  // Shows the new choice at once; the server's answer replaces it when the page comes back.
  const [chosen, setChosen] = useState<Locale>(locale);

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (!isLocale(next)) return;
    setChosen(next);
    startTransition(async () => {
      const result = await setLocale(next);
      if (result.ok) router.refresh();
      else setChosen(locale);
    });
  };

  return (
    <span className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={chosen} onChange={onChange} aria-busy={pending || undefined}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </span>
  );
}
