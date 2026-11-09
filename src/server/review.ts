import { and, asc, eq, ne } from "drizzle-orm";
import type { ReviewActionResult } from "../domain/action-result";
import type { NewActivityEvent } from "../domain/activity";
import { locateFindings, type FindingDraft, type LocatedFinding } from "../domain/finding";
import { extraDaysForHours, formatUsd, priceForHours } from "../domain/money";
import { MAX_FINDINGS_PER_MESSAGE, MAX_REVIEW_MESSAGE_CHARS } from "../domain/review-limit";
import { getScopeReviewer, type ReviewUsage, type ScopeReviewer } from "./ai/review";
import { activityInsert } from "./db/activity";
import { takeClaudeCall } from "./db/claude-calls";
import { getDb, type Db } from "./db/client";
import { activityEvents, changeOrders, findings, messages, projects, scopeItems } from "./db/schema";
import { env } from "./env";

export interface ReviewDeps {
  db: Db;
  reviewer: ScopeReviewer | null; // null when this server has no Claude key
  now: () => Date;
  newId?: () => string;
}

export function liveReviewDeps(): ReviewDeps {
  return { db: getDb(), reviewer: getScopeReviewer(env().ANTHROPIC_API_KEY), now: () => new Date() };
}

const FAILURE_TEXT = {
  unavailable: "Claude didn't answer, so the message wasn't reviewed.",
  unusable: "Claude's answer couldn't be used, so the message wasn't reviewed.",
  refused: "Claude declined to review this message.",
} as const;

const QUOTE_SHOWN_CHARS = 80;
const MAX_TITLE_CHARS = 80;
const MAX_REASON_CHARS = 300;
const MIN_HOURS = 0.25;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// The model's words go on invoices and back into later prompts, so they are made one short line each. Hours are kept to
// two decimals, the precision prices are computed with, and anything under a quarter hour isn't a billable request.
export function cleanDraft(draft: FindingDraft): FindingDraft | null {
  const title = clip(oneLine(draft.title), MAX_TITLE_CHARS);
  const reason = clip(oneLine(draft.reason), MAX_REASON_CHARS);
  const estimatedHours = Math.round(draft.estimatedHours * 100) / 100;
  if (!title || !reason || !(estimatedHours >= MIN_HOURS)) return null;
  return { quote: draft.quote, title, reason, estimatedHours };
}
const shortQuote = (quote: string) => (quote.length > QUOTE_SHOWN_CHARS ? `${quote.slice(0, QUOTE_SHOWN_CHARS)}…` : quote);
const hoursText = (hours: number) => `${hours} ${hours === 1 ? "hour" : "hours"}`;

// The arithmetic shown is the app's, so it says plainly when the $10 rounding moved the price.
function priceSummary(title: string, hours: number, rateCents: number, amountCents: number): string {
  const exact = Math.round(hours * rateCents) === amountCents;
  return `Priced “${title}”: ${hoursText(hours)} at ${formatUsd(rateCents)} an hour${exact ? " is" : ", rounded up to"} ${formatUsd(amountCents)}. Waiting for your review.`;
}

function proposedSummary(kept: readonly LocatedFinding[]): string {
  if (kept.length === 0) return "Found nothing outside the agreed scope.";
  const quotes = kept.map((f) => `“${shortQuote(f.quote)}”`).join(", ");
  return `Marked ${kept.length} ${kept.length === 1 ? "request" : "requests"} outside the agreed scope: ${quotes}.`;
}

const usageDetail = (usage: ReviewUsage) => ({
  model: usage.model,
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  costUsd: usage.costUsd,
});

// Reviews one pasted message for the visitor's own copy. Claude is called first and everything is stored together
// afterwards, so a failed review leaves no half-reviewed message in the thread and the same text can simply be sent again.
export async function reviewOwnedMessage(deps: ReviewDeps, ownerProjectId: string, rawBody: string): Promise<ReviewActionResult> {
  const { db, reviewer, now, newId = () => crypto.randomUUID() } = deps;
  const body = rawBody.trim();
  if (!body) return { ok: false, error: "invalid_input" };
  if (body.length > MAX_REVIEW_MESSAGE_CHARS) return { ok: false, error: "too_long" };
  if (!reviewer) return { ok: false, error: "not_configured" };

  const [projectRows, scopeRows, liveOrders, clientRows] = await db.batch([
    db.select().from(projects).where(eq(projects.id, ownerProjectId)),
    db.select({ title: scopeItems.title }).from(scopeItems).where(eq(scopeItems.projectId, ownerProjectId)).orderBy(asc(scopeItems.position)),
    db
      .select({ title: changeOrders.title })
      .from(changeOrders)
      .where(and(eq(changeOrders.projectId, ownerProjectId), ne(changeOrders.status, "cancelled"))),
    db
      .select({ author: messages.author })
      .from(messages)
      .where(and(eq(messages.projectId, ownerProjectId), eq(messages.from, "client")))
      .orderBy(asc(messages.sentAt))
      .limit(1),
  ]);
  const [project] = projectRows;
  if (!project) return { ok: false, error: "not_found" };

  const startedAt = now();
  if (!(await takeClaudeCall(db, project.id, startedAt))) return { ok: false, error: "rate_limited" };

  const outcome = await reviewer.review({
    projectTitle: project.title,
    clientName: project.clientName,
    scopeItems: scopeRows.map((s) => s.title),
    quotedChangeOrders: liveOrders.map((o) => o.title),
    message: body,
  });

  const at = now().toISOString();
  if (!outcome.ok) {
    await activityInsert(db, {
      projectId: project.id,
      changeOrderId: null,
      kind: "review_failed",
      actor: "claude",
      summary: FAILURE_TEXT[outcome.reason],
      detail: { reason: outcome.reason },
      at,
    });
    return { ok: false, error: outcome.reason === "refused" ? "claude_refused" : "claude_unavailable" };
  }

  // Model output is untrusted: only requests that quote the message exactly survive, priced from the rate.
  const proposed = outcome.findings
    .slice(0, MAX_FINDINGS_PER_MESSAGE)
    .map(cleanDraft)
    .filter((d): d is FindingDraft => d !== null);
  const kept = locateFindings(body, proposed);

  const messageId = newId();
  const findingRows = kept.map((f) => ({
    id: newId(),
    messageId,
    quote: f.quote,
    quoteStart: f.start,
    quoteEnd: f.end,
    title: f.title,
    estimatedHours: f.estimatedHours,
    reason: f.reason,
  }));
  const orderRows = findingRows.map((f) => ({
    id: newId(),
    projectId: project.id,
    findingId: f.id,
    title: f.title,
    hours: f.estimatedHours,
    amountCents: priceForHours(f.estimatedHours, project.hourlyRateCents),
    extraDays: extraDaysForHours(f.estimatedHours, project.hoursPerDay),
    status: "draft" as const,
  }));

  const step = (event: Pick<NewActivityEvent, "changeOrderId" | "kind" | "actor" | "summary" | "detail">): NewActivityEvent => ({
    projectId: project.id,
    at,
    ...event,
  });
  const steps: NewActivityEvent[] = [
    step({
      changeOrderId: null,
      kind: "message_read",
      actor: "app",
      summary: `Read the new message and sent it to Claude with the ${scopeRows.length} agreed scope items.`,
      detail: { characters: body.length },
    }),
    step({
      changeOrderId: null,
      kind: "findings_proposed",
      actor: "claude",
      summary: proposedSummary(kept),
      detail: { ...usageDetail(outcome.usage), marked: kept.length, dropped: outcome.findings.length - kept.length },
    }),
    ...orderRows.map((order) =>
      step({
        changeOrderId: order.id,
        kind: "price_computed",
        actor: "app",
        summary: priceSummary(order.title, order.hours, project.hourlyRateCents, order.amountCents),
        detail: { hours: order.hours, amountCents: order.amountCents },
      }),
    ),
  ];

  const author = clientRows[0]?.author ?? project.clientName;
  await db.batch([
    db.insert(messages).values({ id: messageId, projectId: project.id, from: "client", author, sentAt: at, body }),
    ...(findingRows.length ? [db.insert(findings).values(findingRows)] : []),
    ...(orderRows.length ? [db.insert(changeOrders).values(orderRows)] : []),
    db.insert(activityEvents).values(steps),
  ]);

  console.info("Claude review", { projectId: project.id, ...usageDetail(outcome.usage), marked: kept.length });
  return { ok: true, marked: kept.length };
}
