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
  const draftId = await page.locator("aside[data-status='draft']").getAttribute("data-change-order-id");
  await expect(guide.getByTestId("guide-quick").getByRole("link", { name: "marked request" })).toHaveAttribute("href", `#note-${draftId}`);

  await guide.getByRole("button", { name: "Show details" }).click();
  const step1 = guide.getByTestId("guide-steps").getByRole("listitem").first();
  await expect(step1).toContainText("Live Claude checks are off on this public demo. Maya's Oct 28 message already has a marked request — start at step 3.");
  await expect(step1).not.toContainText("Use a sample message");
  await expect(step1.getByRole("link", { name: "marked request" })).toHaveAttribute("href", `#note-${draftId}`);

  await step1.getByRole("link", { name: "marked request" }).click();
  await expect(page).toHaveURL(new RegExp(`#note-${draftId}$`));
  await expect(page.locator(`#note-${draftId}`)).toBeInViewport();
});

test("작업 기록 패널은 처음에 비어 있다고 안내한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("activity-panel")).toContainText("Nothing yet");
});

test("처음 화면의 데모 안내는 한 줄로 접혀 있고, 자세히 보기로 세 단계를 펼쳤다 접을 수 있다", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByTestId("demo-guide");
  const quick = guide.getByTestId("guide-quick");
  const steps = guide.getByTestId("guide-steps");
  await expect(guide).toContainText("How this demo works.");
  await expect(quick.getByRole("listitem")).toHaveCount(3);
  await expect(quick).toContainText("Claude prices the extra work");
  await expect(steps).toBeHidden();

  await guide.getByRole("button", { name: "Show details" }).click();
  await expect(guide.getByRole("button", { name: "Hide details" })).toHaveAttribute("aria-expanded", "true");
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.getByRole("listitem").first()).toBeVisible();
  await expect(guide.getByText("no real money moves")).toBeVisible();
  await expect(quick).toHaveCount(0);

  await guide.getByRole("button", { name: "Hide details" }).click();
  await expect(steps).toBeHidden();
  await expect(quick).toBeVisible();
});

test("안내를 펼쳐 두면 새로고침해도 펼친 채로 그리고, 접어 두면 접힌 채로 그린다", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByTestId("demo-guide");
  await guide.getByRole("button", { name: "Show details" }).click();

  await page.reload();

  await expect(guide.getByTestId("guide-steps")).toBeVisible();
  await guide.getByRole("button", { name: "Hide details" }).click();

  await page.reload();

  await expect(guide.getByTestId("guide-steps")).toBeHidden();
  await expect(guide.getByRole("button", { name: "Show details" })).toHaveAttribute("aria-expanded", "false");
});

test("안내의 Send change order는 버튼처럼 생긴 글이 아니라 링크이고, 누르면 첫 초안의 보내기 버튼으로 가서 초점을 준다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const link = page.getByTestId("guide-quick").getByRole("link", { name: "Send change order" });

  await link.click();

  const send = page.locator("aside[data-status='draft'] form[data-action='send'] button");
  await expect(send).toBeFocused();
  await expect(send).toBeInViewport();
});

test("새 사본이 거절된 보기 전용 화면은 안내 맨 위에서 알리고, 단계도 보기 전용으로 바꾼다", async ({ page, playwright, baseURL }) => {
  // Past 10 new copies an hour from one address, the next visitor from it gets the view-only preview (demo-limit.ts).
  const address = "198.51.100.77";
  for (let i = 0; i < 10; i++) {
    const visitor = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "X-Forwarded-For": address } });
    await visitor.get("/");
    await visitor.dispose();
  }
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": address });

  await page.goto("/");

  const guide = page.getByTestId("demo-guide");
  await expect(guide.getByTestId("preview-notice")).toHaveText(
    "View-only right now: too many new demos were started recently. Reload in a few minutes to get your own copy.",
  );
  await expect(guide.getByTestId("guide-quick")).toContainText("Reload later to send one yourself");
  await expect(guide.getByTestId("guide-quick")).not.toContainText("Send change order");
  await guide.getByRole("button", { name: "Show details" }).click();
  await expect(guide.getByTestId("guide-steps")).toContainText("Nothing can be checked or sent in this view.");
  await expect(guide).toContainText("Nothing you do in this view is saved.");
  await expect(guide).not.toContainText("Reset demo puts it back");
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
