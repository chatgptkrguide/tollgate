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
// the server renders the page again in that language. A small globe beside it says what it is to sighted visitors who
// don't read the current language; the label says it to screen readers.
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
      const result = await setLocale(next).catch(() => ({ ok: false }));
      if (result.ok) router.refresh();
      else setChosen(locale);
    });
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        className="pointer-events-none absolute left-3 hidden text-ink-2 sm:block"
      >
        <circle cx="8" cy="8" r="6.3" />
        <path d="M1.7 8h12.6M8 1.7c1.9 2 2.6 4.1 2.6 6.3S9.9 12.3 8 14.3M8 1.7C6.1 3.7 5.4 5.8 5.4 8s.7 4.3 2.6 6.3" />
      </svg>
      <select id={id} value={chosen} onChange={onChange} aria-busy={pending || undefined} className="select select-quiet pr-8 sm:pr-9 sm:pl-9" data-testid="locale-switcher">
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </span>
  );
}
