"use client";

import { useEffect } from "react";

interface DocumentLangProps {
  lang: string; // a BCP 47 tag from INTL_TAGS, never visitor input
}

// Puts the request's language on <html lang>. The root layout stays a static shell (Cache Components), so it can't
// read the cookie itself: this is rendered inside a <Suspense> in the layout with the language the server chose. The
// inline script sets it as soon as the streamed HTML arrives, before hydration; the effect keeps it right after a
// router.refresh() (a new language), where scripts in the RSC payload don't run.
export function DocumentLang({ lang }: DocumentLangProps) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <script
      // Rendered as a script on the server only; React warns about rendering one on the client.
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(lang)}` }}
    />
  );
}
