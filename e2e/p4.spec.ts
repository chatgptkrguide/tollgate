import { expect, test } from "@playwright/test";

// This server has no Claude key. The real model is covered by `pnpm eval:review`.
test("키가 없는 서버에서는 Check scope가 꺼져 있고 이유를 말한다", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Check scope" });
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Claude isn't set up on this server")).toBeVisible();
  await page.getByRole("button", { name: "Use a sample message" }).click();
  await button.click({ force: true }); // aria-disabled: Playwright would wait for it to turn on
  await expect(page.getByTestId("review-result")).toBeEmpty();
  await expect(page.locator("#incoming")).not.toHaveValue("");
});

test("작업 기록 패널은 처음에 비어 있다고 안내한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("activity-panel")).toContainText("Nothing yet");
});
