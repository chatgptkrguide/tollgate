"use client";

import { useLayoutEffect, useRef } from "react";
import { formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

export interface CountingAmountProps {
  cents: number;
  locale: Locale;
}

const DURATION_MS = 600;

// A dollar amount that counts to its new value when it changes (including a change order at no charge lowers the
// total). React renders the final value; the animation only rewrites the same text node in between, and under
// reduced motion it doesn't run at all.
export function CountingAmount({ cents, locale }: CountingAmountProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(cents);

  // Before paint, so the new value never flashes before counting starts.
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = cents;
    const node = ref.current?.firstChild;
    if (from === cents || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const final = formatMoney(locale, cents);
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      node.nodeValue = t < 1 ? formatMoney(locale, Math.round((from + (cents - from) * eased) / 100) * 100) : final;
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
      node.nodeValue = final;
    };
  }, [cents, locale]);

  return <span ref={ref}>{formatMoney(locale, cents)}</span>;
}
