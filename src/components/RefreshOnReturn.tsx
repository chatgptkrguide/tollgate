"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { returnRefresher } from "@/components/return-refresh";

// Rendered only while the copy has a sent, unpaid change order. The visitor usually pays it in the PayPal tab, so
// coming back to this tab re-reads the page from the server: once the webhook has landed, the order shows paid
// without a manual reload. At most one refresh every five seconds, however often the tab is switched.
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    const onReturn = returnRefresher(() => router.refresh());
    const onVisibility = () => onReturn(document.visibilityState);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
