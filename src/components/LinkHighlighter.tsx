"use client";

import { useEffect } from "react";

// A ticket and the phrase it came from share a data-link value. Pointing at or focusing either one marks both
// (data-linked), so the eye can follow a ticket back to the message and the other way. One listener for the page.
export function LinkHighlighter() {
  useEffect(() => {
    const linkOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>("[data-link]") : null);
    const setLinked = (key: string, on: boolean) => {
      document.querySelectorAll(`[data-link="${CSS.escape(key)}"]`).forEach((el) => el.toggleAttribute("data-linked", on));
    };
    const enter = (event: Event) => {
      const el = linkOf(event.target);
      if (el?.dataset.link) setLinked(el.dataset.link, true);
    };
    // Moving between children of the same ticket or phrase isn't leaving it.
    const leave = (event: MouseEvent | FocusEvent) => {
      const el = linkOf(event.target);
      if (!el?.dataset.link || linkOf(event.relatedTarget) === el) return;
      setLinked(el.dataset.link, false);
    };

    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
    };
  }, []);

  return null;
}
