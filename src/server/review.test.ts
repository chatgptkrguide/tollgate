import { and, asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_REVIEW_MESSAGE_CHARS, REVIEW_LIMITS_PER_COPY } from "@/domain/review-limit";
import type { ReviewOutcome, ScopeReviewer } from "./ai/review";
import { listActivity } from "./db/activity";
import { createDb, type Db } from "./db/client";
import { ensureDemoCopy, resetDemoCopy } from "./db/demo";
import { runMigrations } from "./db/migrate";
import { getWorkspace } from "./db/queries";
import { changeOrders, findings, messages } from "./db/schema";
import { cleanDraft, reviewOwnedMessage, type ReviewDeps } from "./review";
import { newVisitorId } from "./visitor";

const NOW = new Date("2026-11-05T09:00:00.000Z");
const usage = { model: "claude-opus-5-5", inputTokens: 1200, outputTokens: 300, costUsd: 0.0108 };
const BODY = "Love it! Could you add a blog for seasonal drinks? And please change the button color.";
const blog = { quote: "add a blog for seasonal drinks", title: "Blog", estimatedHours: 6.5, reason: "A blog isn't in the agreed scope." };

describe("메시지 범위 검토", () => {
  let db: Db;
  let projectId: string;
  let review: ReturnType<typeof vi.fn<ScopeReviewer["review"]>>;
  let deps: ReviewDeps;

  const answer = (outcome: ReviewOutcome) => review.mockResolvedValue(outcome);
  const clientMessages = () => db.select().from(messages).where(and(eq(messages.projectId, projectId), eq(messages.body, BODY)));

  beforeEach(async () => {
    db = createDb("file::memory:");
    await runMigrations(db);
    ({ projectId } = await ensureDemoCopy(db, newVisitorId(), NOW));
    review = vi.fn<ScopeReviewer["review"]>();
    deps = { db, reviewer: { review }, now: () => NOW };
  });

  it("제안을 인용 위치·시급 가격과 함께 초안으로 저장한다", async () => {
    answer({ ok: true, findings: [blog], usage });
    expect(await reviewOwnedMessage(deps, projectId, `  ${BODY}\n`)).toEqual({ ok: true, marked: 1 });

    const [message] = await clientMessages();
    expect(message).toMatchObject({ from: "client", author: "Maya Lindqvist", sentAt: NOW.toISOString() });
    const [finding] = await db.select().from(findings).where(eq(findings.messageId, message.id));
    expect(BODY.slice(finding.quoteStart, finding.quoteEnd)).toBe(blog.quote);
    const [order] = await db.select().from(changeOrders).where(eq(changeOrders.findingId, finding.id));
    // 6.5h x $50 = $325, rounded up to the next $10; the model never sets a price.
    expect(order).toMatchObject({ status: "draft", amountCents: 33000, hours: 6.5, extraDays: 2 });

    const workspace = await getWorkspace(db, projectId);
    expect(workspace?.messages.at(-1)?.findings[0].order?.id).toBe(order.id);
  });

  it("Claude에 범위와 이미 낸 견적을 넘긴다", async () => {
    answer({ ok: true, findings: [], usage });
    await reviewOwnedMessage(deps, projectId, BODY);
    expect(review).toHaveBeenCalledWith({
      projectTitle: "Online ordering site",
      clientName: "Harbor & Pine Coffee",
      scopeItems: ["Landing page", "Menu with online ordering", "Contact form"],
      quotedChangeOrders: expect.arrayContaining(["Gift card page", "Loyalty page with customer login"]),
      message: BODY,
    });
  });

  it("작업 기록이 읽기 → 제안 → 가격 순서로 남고 비용을 기록한다", async () => {
    answer({ ok: true, findings: [blog], usage });
    await reviewOwnedMessage(deps, projectId, BODY);
    const steps = await listActivity(db, projectId);
    expect(steps.map((s) => [s.kind, s.actor])).toEqual([
      ["message_read", "app"],
      ["findings_proposed", "claude"],
      ["price_computed", "app"],
    ]);
    expect(steps[1].summary).toContain(`“${blog.quote}”`);
    expect(steps[1].detail).toMatchObject({ costUsd: 0.0108, inputTokens: 1200, outputTokens: 300, marked: 1, dropped: 0 });
    expect(steps[2].summary).toContain("6.5 hours at $50 an hour, rounded up to $330");
    expect(steps[2].changeOrderId).not.toBeNull();
  });

  it("올림이 없으면 올렸다고 적지 않는다", async () => {
    answer({ ok: true, findings: [{ ...blog, estimatedHours: 10 }], usage });
    await reviewOwnedMessage(deps, projectId, BODY);
    expect((await listActivity(db, projectId))[2].summary).toContain("10 hours at $50 an hour is $500");
  });

  it("제목·이유는 한 줄로 줄이고, 시간은 소수 둘째 자리, 15분 미만과 빈 이유는 버린다", () => {
    expect(cleanDraft({ ...blog, title: `  A\n\nblog ${"x".repeat(200)}`, reason: "Not\tin scope.\n", estimatedHours: 33.33333 })).toMatchObject({
      title: expect.stringMatching(/^A blog x+…$/),
      reason: "Not in scope.",
      estimatedHours: 33.33,
    });
    expect(cleanDraft({ ...blog, title: "  A\n\nblog " + "x".repeat(200) })?.title).toHaveLength(80);
    expect(cleanDraft({ ...blog, estimatedHours: 0.004 })).toBeNull();
    expect(cleanDraft({ ...blog, reason: "  " })).toBeNull();
  });

  it("메시지에 없는 인용은 버리고 버린 수를 남긴다", async () => {
    const made = { quote: "build a mobile app", title: "App", estimatedHours: 40, reason: "Not asked." };
    answer({ ok: true, findings: [blog, made], usage });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: true, marked: 1 });
    const steps = await listActivity(db, projectId);
    expect(steps[1].detail).toMatchObject({ marked: 1, dropped: 1 });
  });

  it("범위 안 메시지는 표시 없이 저장한다", async () => {
    answer({ ok: true, findings: [], usage });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: true, marked: 0 });
    expect(await clientMessages()).toHaveLength(1);
    expect((await listActivity(db, projectId)).map((s) => s.kind)).toEqual(["message_read", "findings_proposed"]);
  });

  it("검토 시간이 말도 안 되면 표시하지 않는다", async () => {
    answer({ ok: true, findings: [{ ...blog, estimatedHours: 5000 }], usage });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: true, marked: 0 });
  });

  it("실패하면 메시지를 저장하지 않고 다시 보낼 수 있다", async () => {
    answer({ ok: false, reason: "unavailable" });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: false, error: "claude_unavailable" });
    expect(await clientMessages()).toHaveLength(0);
    expect((await listActivity(db, projectId)).map((s) => s.kind)).toEqual(["review_failed"]);

    answer({ ok: true, findings: [blog], usage });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: true, marked: 1 });
  });

  it("거절은 따로 알린다", async () => {
    answer({ ok: false, reason: "refused" });
    expect(await reviewOwnedMessage(deps, projectId, BODY)).toEqual({ ok: false, error: "claude_refused" });
  });

  it("키가 없으면 호출하지 않고 안내한다", async () => {
    expect(await reviewOwnedMessage({ ...deps, reviewer: null }, projectId, BODY)).toEqual({ ok: false, error: "not_configured" });
    expect(await db.all(sql`SELECT count(*) AS n FROM claude_calls`)).toEqual([{ n: 0 }]);
  });

  it("빈 메시지와 너무 긴 메시지는 호출하지 않는다", async () => {
    expect(await reviewOwnedMessage(deps, projectId, "   ")).toEqual({ ok: false, error: "invalid_input" });
    expect(await reviewOwnedMessage(deps, projectId, "x".repeat(MAX_REVIEW_MESSAGE_CHARS + 1))).toEqual({ ok: false, error: "too_long" });
    expect(review).not.toHaveBeenCalled();
  });

  it("없는 사본은 not_found", async () => {
    expect(await reviewOwnedMessage(deps, "v_nothing", BODY)).toEqual({ ok: false, error: "not_found" });
    expect(review).not.toHaveBeenCalled();
  });

  it("상한을 넘으면 호출하지 않고, 데모 초기화로 풀리지 않는다", async () => {
    answer({ ok: true, findings: [], usage });
    const max = REVIEW_LIMITS_PER_COPY[0].max;
    for (let i = 0; i < max; i++) {
      // Spaced past the per-minute server cap.
      const later = { ...deps, now: () => new Date(NOW.getTime() + i * 7 * 60 * 1000) };
      expect((await reviewOwnedMessage(later, projectId, BODY)).ok).toBe(true);
    }
    const end = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    expect(await resetDemoCopy(db, projectId, end)).toBe("reset");
    review.mockClear();
    expect(await reviewOwnedMessage({ ...deps, now: () => end }, projectId, BODY)).toEqual({ ok: false, error: "rate_limited" });
    expect(review).not.toHaveBeenCalled();
  });

  it("다른 사본은 내 검토 결과를 보지 못한다", async () => {
    const other = await ensureDemoCopy(db, newVisitorId(), NOW);
    answer({ ok: true, findings: [blog], usage });
    await reviewOwnedMessage(deps, projectId, BODY);
    expect(await listActivity(db, other.projectId)).toEqual([]);
    const rows = await db.select().from(messages).where(eq(messages.projectId, other.projectId)).orderBy(asc(messages.sentAt));
    expect(rows.map((m) => m.body)).not.toContain(BODY);
  });
});
