import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense, type ReactElement } from "react";
import { Workspace } from "@/components/Workspace";
import { WorkspaceSkeleton } from "@/components/WorkspaceSkeleton";
import type { Locale } from "@/i18n/locales";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/t";
import { listActivity } from "@/server/db/activity";
import { getDb } from "@/server/db/client";
import { openVisitorWorkspace } from "@/server/db/queries";
import { env } from "@/server/env";
import { clientAddress, demoCopyGate } from "@/server/demo-limit";
import { paypalConfig } from "@/server/paypal/token";
import { readVisitorId } from "@/server/session";

interface MissingVisitorNoticeProps {
  locale: Locale;
}

// The loading screen is the Suspense fallback, so it can't wait for data; it reads only the language (a cookie or a
// header, no database) inside its own small Suspense, and the static shell shows it in English until then.
export default function Home() {
  return (
    <Suspense
      fallback={
        <Suspense fallback={<WorkspaceSkeleton />}>
          <LocalizedSkeleton />
        </Suspense>
      }
    >
      <VisitorWorkspace />
    </Suspense>
  );
}

async function LocalizedSkeleton(): Promise<ReactElement> {
  const locale = await getLocale();
  return <WorkspaceSkeleton loading={t(locale, "skeleton.loading")} />;
}

// Reads the visitor cookie, creates the visitor's own copy on the first visit, then renders it from the database.
// Past the limits on new copies it renders the seed from memory instead.
// Without sandbox keys (a judge running it locally, the phase 1 browser tests) sending stays off and says why.
async function VisitorWorkspace(): Promise<ReactElement> {
  const [visitorId, locale] = await Promise.all([readVisitorId(), getLocale()]);
  if (!visitorId) return <MissingVisitorNotice locale={locale} />;
  // Cookies alone still allow a prerender (Partial Prefetching builds a per-session shell with them).
  // Everything below needs a real request: the clock, random ids, and the copy's database writes.
  await connection();

  const db = getDb();
  const mayCreate = demoCopyGate(clientAddress(await headers()));
  const { data, preview } = await openVisitorWorkspace(db, visitorId, new Date(), { mayCreate });
  if (preview) {
    // The seed from memory: no row exists, so there is no activity to read and every action would answer not_found.
    const reason = t(locale, "page.previewOnly");
    return <Workspace data={data} activity={[]} sendBlockedReason={reason} reviewBlockedReason={reason} previewReason={reason} locale={locale} />;
  }
  const activity = await listActivity(db, data.project.id);
  return (
    <Workspace
      data={data}
      activity={activity}
      sendBlockedReason={paypalConfig() ? null : t(locale, "page.sendBlocked")}
      reviewBlockedReason={env().ANTHROPIC_API_KEY ? null : t(locale, "page.reviewBlocked")}
      previewReason={null}
      locale={locale}
    />
  );
}

// Only when the request skipped proxy.ts, so it has no visitor cookie yet.
function MissingVisitorNotice({ locale }: MissingVisitorNoticeProps) {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
      <p className="font-display text-[22px] font-bold">{t(locale, "page.missingVisitor")}</p>
    </main>
  );
}
