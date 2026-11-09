import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";

// This server has no Claude key. The real model is covered by `pnpm eval:review`.
test("키가 없는 서버에서는 Check scope가 꺼져 있고, 누르면 결과 줄에 이유를 말한다", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Check scope" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Claude isn't set up on this server")).toBeVisible();
  await expect(page.getByTestId("review-result")).toBeEmpty();
  await page.getByRole("button", { name: "Use a sample message" }).click();

  await button.click({ force: true }); // aria-disabled: Playwright would wait for it to turn on

  await expect(page.getByTestId("review-result")).toHaveText("Claude isn't set up on this server, so messages can't be checked.");
  await expect(page.getByText("Claude isn't set up on this server")).toHaveCount(2); // the result line + the sr-only description
  await expect(page.locator("#check-blocked")).toHaveClass(/sr-only/);
  await expect(page.locator("#incoming")).not.toHaveValue("");
});

test("Claude가 꺼진 서버의 안내 1단계는 이미 표시된 요청으로 보내고, 그 링크가 해당 견적 메모로 간다", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByTestId("demo-guide");
  const step1 = guide.getByRole("listitem").first();
  await expect(step1).toContainText("Live Claude checks are off on this public demo. Maya's Oct 28 message already has a marked request — start at step 3.");
  await expect(step1).not.toContainText("Use a sample message");

  const draftId = await page.locator("aside[data-status='draft']").getAttribute("data-change-order-id");
  await expect(step1.getByRole("link", { name: "marked request" })).toHaveAttribute("href", `#note-${draftId}`);
  await expect(guide.getByRole("listitem").nth(2).getByRole("link", { name: "Go to the change order" })).toHaveAttribute("href", `#note-${draftId}`);

  await step1.getByRole("link", { name: "marked request" }).click();
  await expect(page).toHaveURL(new RegExp(`#note-${draftId}$`));
  await expect(page.locator(`#note-${draftId}`)).toBeInViewport();
});

test("작업 기록 패널은 처음에 비어 있다고 안내한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("activity-panel")).toContainText("Nothing yet");
});

test("처음 화면에 데모 안내 세 단계가 보이고, 접었다 펼 수 있다", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByTestId("demo-guide");
  await expect(guide).toContainText("How this demo works.");
  await expect(guide).toHaveAttribute("open", "");
  await expect(guide.getByRole("listitem")).toHaveCount(3);
  await expect(guide.getByText("no real money moves")).toBeVisible();

  await guide.locator("summary").click();
  await expect(guide.getByRole("listitem").first()).toBeHidden();
  await guide.locator("summary").click();
  await expect(guide.getByRole("listitem").first()).toBeVisible();
});

test("사본에 작업 기록이 생기면 데모 안내가 접힌 채로 열린다", async ({ page }) => {
  await page.goto("/");
  const projectId = await page.getByTestId("workspace").getAttribute("data-project-id");
  // Nothing on this server (no Claude, no PayPal) writes activity, so the step goes straight into its database.
  const db = createClient({ url: "file:data/e2e.db" });
  await db.execute("PRAGMA busy_timeout = 5000"); // the server may be writing the same file (SQLITE_BUSY otherwise)
  await db.execute({
    sql: "INSERT INTO activity_events (project_id, change_order_id, kind, actor, summary, detail, at) VALUES (?, NULL, 'message_read', 'claude', 'Read a message', NULL, ?)",
    args: [projectId, new Date().toISOString()],
  });
  db.close();

  await page.reload();

  const guide = page.getByTestId("demo-guide");
  await expect(guide).not.toHaveAttribute("open");
  await expect(guide.getByRole("listitem").first()).toBeHidden();
  await guide.locator("summary").click();
  await expect(guide.getByRole("listitem").first()).toBeVisible();
});

test("머리말은 'Total with changes'와 아직 받지 못한 금액을 보여 주고, 범위 목록의 초안은 'Not sent yet'이다", async ({ page }) => {
  await page.goto("/");

  const total = page.getByTestId("header-total");
  await expect(total).toContainText("Total with changes");
  await expect(total).toContainText("$3,300");
  await expect(total).toContainText("$650 not paid yet");
  const scope = page.getByRole("region", { name: "Scope" });
  await expect(scope.getByRole("listitem").filter({ hasText: "Loyalty page with customer login" })).toContainText("Not sent yet");
  await expect(page.getByText("Waiting for your review")).toHaveCount(0);
});

test("범위 패널의 Total은 미결제가 있으면 STOP, 모두 정리되면 GO이고 받을 금액이 'All paid'로 바뀐다", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const scopeTotal = page.getByTestId("scope-totals").locator("div").last().locator("dd");
  await expect(scopeTotal).toHaveAttribute("data-tone", "stop");

  await page.getByRole("button", { name: "Include at no charge", exact: true }).click();
  await page.getByRole("button", { name: "Confirm: include at no charge", exact: true }).click();

  await expect(scopeTotal).toHaveAttribute("data-tone", "go");
  await expect(page.getByTestId("header-total")).not.toContainText("not paid yet");
  await expect(page.getByTestId("header-total")).toContainText("All paid");
  const included = page.getByTestId("delivery-panel").locator("[data-delivery-state='included']");
  await expect(included).toContainText("Included at no charge");
  await expect(included.locator(".swatch")).toHaveAttribute("data-state", "included");
  await context.close();
});
